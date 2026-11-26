// Sky Courier — world model: terrain, flight physics, missions, scoring.
// Pure logic only: no DOM, no canvas, no Audio. Every function here is
// importable in Node, which is how the test suite exercises it.
// The world is deterministic: all randomness comes from the seed.

import { AIRPORTS, PLANES, WEATHER, WORLD, buildMissions } from './config.js';
import { angleDiffDeg, clamp, degToRad, fbm2, hash2, lerp, noise2 } from './random.js';

export const STEP = 1 / 60;

export function airportByCode(code) {
  return AIRPORTS.find((a) => a.code === code) ?? AIRPORTS[0];
}

export function planeById(id) {
  return PLANES.find((p) => p.id === id) ?? PLANES[0];
}

// ---- terrain ----------------------------------------------------------

// Three lakes, fixed by design (Lakeshore sits on the biggest one).
const LAKES = [
  { x: -900, z: -6400, r: 900 },
  { x: 2600, z: 1400, r: 620 },
  { x: -4200, z: 4200, r: 540 },
];

export function terrainHeight(x, z, seed = WORLD.seed) {
  const r = Math.hypot(x, z);
  let h = (fbm2(x / 900, z / 900, seed, 3) - 0.5) * 2 * WORLD.hillAmp;
  h += (fbm2(x / 260, z / 260, seed + 7, 2) - 0.5) * 26;
  // Mountain ring far from the centre.
  if (r > WORLD.mountainRadius) {
    const t = Math.min(1, (r - WORLD.mountainRadius) / 1600);
    h += t * WORLD.mountainAmp * (0.45 + 0.55 * fbm2(x / 500, z / 500, seed + 21, 2));
  }
  // Lakes are bowls sunk just below sea level.
  for (const lake of LAKES) {
    const d = Math.hypot(x - lake.x, z - lake.z);
    if (d < lake.r) {
      const t = 1 - d / lake.r;
      h = lerp(h, -6, t * t);
    }
  }
  // Flatten the ground around every airport so runways are level.
  for (const a of AIRPORTS) {
    const d = Math.hypot(x - a.x, z - a.z);
    if (d < WORLD.flatRadius + 260) {
      const t = clamp((d - WORLD.flatRadius) / 260, 0, 1);
      h *= t * t * (3 - 2 * t);
    }
  }
  return h;
}

// What the ground looks like at a point: used by the renderer to paint
// the terrain bands, and by the physics to know what you hit.
export function terrainKind(x, z, seed = WORLD.seed) {
  const h = terrainHeight(x, z, seed);
  for (const lake of LAKES) {
    if (Math.hypot(x - lake.x, z - lake.z) < lake.r * 0.98) return 'water';
  }
  if (h > 190) return 'snow';
  if (h > 130) return 'rock';
  for (const a of AIRPORTS) {
    const d = Math.hypot(x - a.x, z - a.z);
    // The town rings the airfield: the inner 200 is runway and apron
    // (field), the 200-420 ring is town, so an airport centre is never
    // classified as town.
    if (a.town && d >= 200 && d < 420) return 'town';
    if (d < WORLD.flatRadius) return 'field';
  }
  const n = noise2(x / 420, z / 420, seed + 55);
  if (n > 0.62) return 'forest';
  if (n < 0.2) return 'meadow';
  return 'field';
}

// ---- runway geometry --------------------------------------------------

export function runwayVector(airport) {
  const rad = degToRad(airport.hdg);
  return { dx: Math.sin(rad), dz: -Math.cos(rad) };
}

// Along-track and cross-track distance of a point from a runway centre.
export function runwayCoords(airport, x, z) {
  const { dx, dz } = runwayVector(airport);
  const rx = x - airport.x;
  const rz = z - airport.z;
  return { along: rx * dx + rz * dz, across: rx * -dz + rz * dx };
}

export function runwayCorners(airport) {
  const { dx, dz } = runwayVector(airport);
  const px = -dz;
  const pz = dx;
  const L = WORLD.runwayLength / 2;
  const W = WORLD.runwayWidth / 2;
  const cx = airport.x;
  const cz = airport.z;
  return [
    { x: cx - dx * L - px * W, z: cz - dz * L - pz * W },
    { x: cx + dx * L - px * W, z: cz + dz * L - pz * W },
    { x: cx + dx * L + px * W, z: cz + dz * L + pz * W },
    { x: cx - dx * L + px * W, z: cz - dz * L + pz * W },
  ];
}

// ---- missions ---------------------------------------------------------

function ringCourse(mission, seed) {
  const from = airportByCode(mission.from);
  const to = airportByCode(mission.to);
  const rings = [];
  const n = mission.rings;
  if (n <= 0) return rings;
  const circuit = mission.from === mission.to;
  for (let i = 0; i < n; i += 1) {
    let x;
    let z;
    if (circuit) {
      const ang = (i / n) * Math.PI * 2 + 0.6;
      const rad = 1500 + hash2(i, mission.id, seed) * 900;
      x = from.x + Math.cos(ang) * rad;
      z = from.z + Math.sin(ang) * rad;
    } else {
      const t = (i + 1) / (n + 1);
      const off = (hash2(i, mission.id, seed) - 0.5) * 1400;
      x = lerp(from.x, to.x, t) + off;
      z = lerp(from.z, to.z, t) - off * 0.6;
    }
    rings.push({
      x,
      z,
      y: 150 + hash2(i, 77, seed) * 130,
      r: 42,
      hit: false,
    });
  }
  return rings;
}

function tourWaypoints(mission, seed) {
  const from = airportByCode(mission.from);
  const points = [];
  const n = Math.max(3, mission.rings);
  for (let i = 0; i < n; i += 1) {
    const ang = (i / n) * Math.PI * 2 + 0.35;
    const rad = 1700 + hash2(i, mission.id + 5, seed) * 1100;
    points.push({
      x: from.x + Math.cos(ang) * rad,
      z: from.z + Math.sin(ang) * rad,
      y: 220,
      label: `Waypoint ${i + 1}`,
      done: false,
    });
  }
  return points;
}

// ---- flight state -----------------------------------------------------

export function createFlight({ seed = WORLD.seed, planeId = 'sparrow', missionId = 1, cash = WORLD.startCash } = {}) {
  const missions = buildMissions();
  const mission = missions.find((m) => m.id === missionId) ?? missions[0];
  const plane = planeById(planeId);
  const weather = WEATHER[mission.weather] ?? WEATHER.clear;
  const from = airportByCode(mission.from);
  const to = airportByCode(mission.to);
  const { dx, dz } = runwayVector(from);
  // Parked at the runway threshold, facing down the runway.
  const startX = from.x - dx * (WORLD.runwayLength / 2 - 40);
  const startZ = from.z - dz * (WORLD.runwayLength / 2 - 40);
  return {
    seed,
    plane,
    mission,
    weather,
    cash,
    time: 0,
    x: startX,
    y: 0,
    z: startZ,
    heading: from.hdg,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: plane.fuel,
    damage: 0,
    gear: true,
    flaps: false,
    brakes: false,
    score: 0,
    earned: 0,
    rings: ringCourse(mission, seed),
    waypoints: mission.type === 'tour' ? tourWaypoints(mission, seed) : [],
    dest: to,
    phase: 'takeoff',
    airborne: false,
    landed: false,
    touchdown: false,
    crashed: false,
    crashReason: '',
    complete: false,
    failed: false,
    stars: 0,
    smoothLanding: false,
    missionTime: 0,
    events: [`Depart ${from.code} for ${to.code}`],
    stats: { ringsHit: 0, maxAlt: 0, topSpeed: 0, landings: 0 },
    gustPhase: 0,
    vspeed: 0,
  };
}

// Airborne start (used by screenshots and the "quick flight" mode).
export function createAirborne({ seed = WORLD.seed, planeId = 'sparrow', missionId = 1, altitude = 220, speed = 26 } = {}) {
  const f = createFlight({ seed, planeId, missionId });
  const from = airportByCode(f.mission.from);
  const to = airportByCode(f.mission.to);
  // Mid-route, level, on course for the destination.
  f.x = lerp(from.x, to.x, 0.45);
  f.z = lerp(from.z, to.z, 0.45);
  f.y = altitude;
  f.heading = (Math.atan2(to.x - f.x, -(to.z - f.z)) * 180) / Math.PI;
  if (f.heading < 0) f.heading += 360;
  f.speed = speed;
  f.throttle = 0.75;
  f.phase = 'enroute';
  f.airborne = true;
  return f;
}

// ---- physics ----------------------------------------------------------

export function stepFlight(s, input, dt = STEP) {
  if (s.crashed || s.complete) return s;
  const p = s.plane;
  const w = s.weather;
  s.time += dt;
  s.missionTime += dt;
  s.gustPhase += dt;

  // Throttle moves toward the commanded setting.
  const targetThrottle = s.fuel <= 0 ? 0 : clamp(input.throttle ?? s.throttle, 0, 1);
  s.throttle += clamp(targetThrottle - s.throttle, -0.6 * dt, 0.6 * dt);

  // Attitude follows the stick, faster when there is airflow.
  const authority = clamp(s.speed / p.stall, 0.25, 1);
  const pitchTarget = clamp(input.pitch ?? 0, -1, 1) * WORLD.maxPitchDeg;
  const rollTarget = clamp(input.roll ?? 0, -1, 1) * WORLD.maxRollDeg;
  s.pitch += clamp(pitchTarget - s.pitch, -34 * authority * dt, 34 * authority * dt);
  s.roll += clamp(rollTarget - s.roll, -70 * authority * dt, 70 * authority * dt);

  // Banked turns: heading follows the bank, more at higher speed.
  const turnRate = p.turn * Math.sin(degToRad(s.roll)) * clamp(s.speed / p.maxSpeed, 0.25, 1);
  s.heading = (s.heading + turnRate * dt + 360) % 360;

  // Speed: throttle pulls toward cruise, climbing costs speed.
  const cruise = p.maxSpeed * (0.3 + 0.7 * s.throttle);
  let accel = (cruise - s.speed) * 0.32;
  accel -= Math.sin(degToRad(s.pitch)) * 7;
  if (s.flaps) accel -= 0.7;
  if (s.brakes) accel -= 9;
  if (s.gear && s.speed > p.stall) accel -= 0.3;
  s.speed = Math.max(0, s.speed + accel * dt);

  // Vertical speed: pitch and power lift the plane, but only once there
  // is enough airflow over the wing; below stall speed the wing quits
  // and the nose drops.
  const stalled = s.speed < p.stall;
  let vs = 0;
  if (s.speed > p.stall * 0.6) {
    vs = s.speed * Math.sin(degToRad(s.pitch));
    if (!stalled) vs += (s.throttle - 0.5) * p.climb * 0.35;
  }
  if (stalled) vs -= (p.stall - s.speed) * 2.0;
  if (s.flaps && s.speed > p.stall) vs -= 1.5;
  s.vspeed = vs;
  s.y += vs * dt;

  // Move forward along the heading, pushed around by wind and gusts.
  const hRad = degToRad(s.heading);
  const gust = w.gust * Math.sin(s.gustPhase * 1.7) * 0.6;
  const wx = w.wind[0] + gust;
  const wz = w.wind[1] + gust * 0.5;
  s.x += (Math.sin(hRad) * s.speed + wx) * dt;
  s.z += (-Math.cos(hRad) * s.speed + wz) * dt;
  if (w.gust > 0) {
    s.roll += Math.sin(s.gustPhase * 2.3) * w.gust * 1.6 * dt;
  }

  // Fuel burn: cruise sips, full throttle drinks.
  // Fuel: the bigger the tank, the longer it lasts. At cruise power the
  // Sparrow's 100 units last roughly eight minutes — enough for a leg,
  // tight enough that full throttle the whole way is a real choice.
  const burn = (0.05 + s.throttle * 0.18) * (100 / p.fuel);
  s.fuel = Math.max(0, s.fuel - burn * dt);

  s.stats.maxAlt = Math.max(s.stats.maxAlt, s.y);
  s.stats.topSpeed = Math.max(s.stats.topSpeed, s.speed);

  // Rings: flying through one scores.
  for (const ring of s.rings) {
    if (ring.hit) continue;
    const d = Math.hypot(s.x - ring.x, s.y - ring.y, s.z - ring.z);
    if (d < ring.r) {
      ring.hit = true;
      s.stats.ringsHit += 1;
      s.score += 150;
      s.events.push(`Ring ${s.stats.ringsHit} of ${s.rings.length} (+150)`);
    }
  }

  // Tour waypoints.
  for (const wp of s.waypoints) {
    if (wp.done) continue;
    if (Math.hypot(s.x - wp.x, s.z - wp.z) < 160 && Math.abs(s.y - wp.y) < 110) {
      wp.done = true;
      s.score += 120;
      s.events.push(`${wp.label} passed (+120)`);
    }
  }

  // Out of time: the mission fails, but you can still fly home.
  if (!s.failed && s.missionTime > s.mission.timeLimit) {
    s.failed = true;
    s.events.push('Out of time — the client walked away');
  }

  // Ground contact.
  const ground = terrainHeight(s.x, s.z, s.seed);
  const agl = s.y - ground;
  if (agl > 2) s.airborne = true;
  if (agl <= 0) {
    s.y = ground;
    checkGroundContact(s);
  }

  // Leaving the map: turn the plane gently back toward the centre.
  const r = Math.hypot(s.x, s.z);
  if (r > WORLD.halfSize + 600) {
    const homeHdg = (Math.atan2(-s.x, s.z) * 180) / Math.PI;
    const home = homeHdg < 0 ? homeHdg + 360 : homeHdg;
    s.heading += clamp(angleDiffDeg(home, s.heading), -20 * dt, 20 * dt);
    s.events.push('Turn back — edge of the chart');
  }
  return s;
}

function checkGroundContact(s) {
  const p = s.plane;
  // Which runway, if any, are we on?
  let runway = null;
  let best = 1e9;
  for (const a of AIRPORTS) {
    const { along, across } = runwayCoords(a, s.x, s.z);
    if (Math.abs(across) < WORLD.runwayWidth / 2 + 8 && along > -WORLD.runwayLength / 2 - 80 && along < WORLD.runwayLength / 2 + 80) {
      const d = Math.abs(across);
      if (d < best) {
        best = d;
        runway = a;
      }
    }
  }
  // Still on the takeoff roll: not a landing, not a crash — just roll.
  // (Running off the end of the runway at speed is a crash, though.)
  if (!s.airborne) {
    if (runway === null && s.speed > 8) crash(s, 'Ran off the end of the runway');
    return;
  }
  // Already touched down and rolling out: keep slowing, do not
  // re-judge the landing — as the speed drops below stall the sink
  // would otherwise read as a hard impact on a later step.
  if (s.touchdown) {
    s.speed = Math.max(0, s.speed - 14 * STEP);
    s.pitch = 0;
    s.roll *= 0.9;
    s.vspeed = 0;
    if (s.speed < 1.5 && !s.landed) {
      s.landed = true;
      s.stats.landings += 1;
      finishFlight(s, runway);
    }
    return;
  }
  const aligned = runway !== null
    && (Math.abs(angleDiffDeg(s.heading, runway.hdg)) < 28
      || Math.abs(angleDiffDeg(s.heading, runway.hdg + 180)) < 28);
  const gentle = s.vspeed > -7.5;
  const slowEnough = s.speed < p.maxSpeed * 0.85;

  if (runway !== null && aligned && gentle && slowEnough && s.gear) {
    // A landing. Roll out, then stop.
    const touchdownVspeed = s.vspeed;
    const touchdownRoll = s.roll;
    s.touchdown = true;
    s.speed = Math.max(0, s.speed - 14 * STEP);
    s.pitch = 0;
    s.roll *= 0.9;
    s.vspeed = 0;
    if (s.speed < 1.5 && !s.landed) {
      s.landed = true;
      s.stats.landings += 1;
      s.smoothLanding = Math.abs(touchdownVspeed) < 3.5 && Math.abs(touchdownRoll) < 12;
      finishFlight(s, runway);
    }
    return;
  }
  if (runway !== null && aligned && gentle && slowEnough && !s.gear) {
    crash(s, 'Belly landing — the gear was up');
    return;
  }
  if (s.speed > 6) {
    if (runway !== null && !aligned) crash(s, 'Ran off the runway');
    else if (s.vspeed < -12) crash(s, 'Hit the ground too hard');
    else crash(s, 'Controlled flight into terrain');
    return;
  }
  // Slow taxi-speed contact on rough ground: just stop, no crash.
  s.speed = 0;
  if (!s.landed) {
    s.landed = true;
    finishFlight(s, runway);
  }
}

function crash(s, reason) {
  s.crashed = true;
  s.crashReason = reason;
  s.damage = 100;
  s.events.push(`Crashed: ${reason}`);
}

function finishFlight(s, runway) {
  const m = s.mission;
  const atDest = runway !== null && runway.code === m.to;
  const atHome = runway !== null && runway.code === m.from;
  let done = false;
  if (m.type === 'tour') {
    done = s.waypoints.every((w) => w.done) && runway !== null;
  } else if (m.type === 'rings') {
    done = s.rings.every((r) => r.hit) && (atDest || atHome);
  } else {
    done = atDest;
  }
  if (!done) {
    s.events.push(runway ? `Landed at ${runway.code} — wrong airfield for this job` : 'Landed off-airfield');
    return;
  }
  s.complete = true;
  s.phase = 'done';
  if (s.failed) {
    // Too late: the client walked away. The landing still counts as a
    // flight, but there is no pay and no stars for it.
    s.earned = 0;
    s.stars = 0;
    s.events.push('Landed too late — no pay for this one');
    return;
  }
  let pay = m.pay;
  if (m.type === 'time') {
    const left = Math.max(0, m.timeLimit - s.missionTime);
    pay += Math.round(left * 2);
  }
  if (s.smoothLanding) pay += 120;
  pay += s.score;
  s.earned = pay;
  s.cash += pay;
  const allRings = s.rings.length === 0 || s.rings.every((r) => r.hit);
  const allWp = s.waypoints.length === 0 || s.waypoints.every((w) => w.done);
  const fast = s.missionTime < m.timeLimit * 0.7;
  s.stars = 1 + (allRings && allWp ? 1 : 0) + (fast || s.smoothLanding ? 1 : 0);
  s.events.push(`Mission complete — $${pay} earned, ${s.stars} star${s.stars > 1 ? 's' : ''}`);
}

// ---- helpers for the UI and the autopilot -----------------------------

export function distanceTo(s, code) {
  const a = airportByCode(code);
  return Math.hypot(a.x - s.x, a.z - s.z);
}

export function bearingTo(s, x, z) {
  const b = (Math.atan2(x - s.x, -(z - s.z)) * 180) / Math.PI;
  return b < 0 ? b + 360 : b;
}

// Short state fingerprint for the determinism test: same inputs must
// always produce the same fingerprint.
export function stateFingerprint(s) {
  const n = (v) => Math.round(v * 1000) / 1000;
  return [
    n(s.x), n(s.y), n(s.z), n(s.heading), n(s.pitch), n(s.roll),
    n(s.speed), n(s.throttle), n(s.fuel), s.score, s.stats.ringsHit,
  ].join('|');
}

export function missionList() {
  return buildMissions();
}
