// Sky Courier — screenshot scenes behind ?shot=...&seed=...
// Each scene plays the real rules forward from a fresh flight for a fixed
// number of steps, steered by a simple autopilot, so the frame is what a
// real game looks like and the same seed always gives the same frame.
// Shots: flight (cover — chase view, ring ahead), approach (final to the
// runway), title (parked at home, title screen), debrief (mission done).

import { STEP, bearingTo, createAirborne, createFlight, runwayVector, stepFlight, terrainHeight } from './world.js';
import { WORLD } from './config.js';
import { angleDiffDeg, clamp, degToRad } from './random.js';

// Steer toward a 3D target: heading for the bearing, pitch for the
// altitude, throttle to hold cruise speed. Returns stick input.
function autopilotTo(f, tx, ty, tz, cruiseSpeed) {
  const bearing = bearingTo(f, tx, tz);
  const turn = clamp(angleDiffDeg(bearing, f.heading) / 30, -1, 1);
  const altErr = ty - f.y;
  const pitch = clamp(altErr / 90, -1, 1) * 0.7;
  const throttle = f.speed < cruiseSpeed ? 0.85 : 0.6;
  return { pitch, roll: turn, throttle };
}

function runSteps(f, seconds, pilot) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (f.crashed || f.complete) break;
    stepFlight(f, pilot(f), STEP);
  }
  return f;
}

// Fly the current mission's route: climb out, cruise to the destination,
// descend and land. Used by the debrief shot.
export function autopilotMission(f) {
  const dest = f.dest;
  // Runway geometry, along the real runway axis: the two thresholds,
  // the nearer one, and the landing direction (threshold -> centre).
  const u = runwayVector(dest);
  const half = WORLD.runwayLength / 2;
  const t1x = dest.x - u.dx * half;
  const t1z = dest.z - u.dz * half;
  const t2x = dest.x + u.dx * half;
  const t2z = dest.z + u.dz * half;
  const d1 = (f.x - t1x) ** 2 + (f.z - t1z) ** 2;
  const d2 = (f.x - t2x) ** 2 + (f.z - t2z) ** 2;
  const tx = d1 <= d2 ? t1x : t2x;
  const tz = d1 <= d2 ? t1z : t2z;
  const ux = (dest.x - tx) / half;
  const uz = (dest.z - tz) / half;
  const landingHeading = (Math.atan2(ux, -uz) * 180) / Math.PI;
  if (f.phase === 'takeoff') {
    if (f.speed < f.plane.stall + 6) return { pitch: 0, roll: 0, throttle: 1 };
    f.phase = 'enroute';
  }
  // Final approach fix: a point on the runway's extended centreline,
  // 1800 before the threshold. Fly straight to it — no cruise leg that
  // fights the approach — so the plane arrives ON the centreline
  // instead of crossing it at an angle. Once reached, the approach is
  // latched: flying past the fix must not send the plane back to it.
  const fafX = tx - ux * 1800;
  const fafZ = tz - uz * 1800;
  const distFaf = Math.hypot(fafX - f.x, fafZ - f.z);
  if (distFaf < 150) f.fafReached = true;
  if (!f.fafReached) {
    return autopilotTo(f, fafX, 150, fafZ, f.plane.maxSpeed * 0.8);
  }
  // Final approach, flown like an ILS localizer: the plane steers to an
  // intercept heading that blends into the runway heading as the
  // cross-track error shrinks, and descends a 3-degree glidepath to the
  // threshold. This converges from any starting position — there is no
  // gate to miss and no circle to fly. Overshoot the runway and the
  // pilot climbs out and comes back around for another try.
  f.gear = true;
  f.flaps = true;
  // Coordinates in the landing frame: alongL is distance past the
  // threshold toward the centre (negative on the approach), acrossL is
  // the cross-track error.
  const alongL = (f.x - tx) * ux + (f.z - tz) * uz;
  const acrossL = (f.x - tx) * -uz + (f.z - tz) * ux;
  const intercept = landingHeading - clamp(acrossL * 0.3, -50, 50);
  const turn = clamp(angleDiffDeg(intercept, f.heading) / 30, -1, 1);
  const groundHere = terrainHeight(f.x, f.z, f.seed);
  const distT = Math.hypot(alongL, acrossL);
  let altTarget;
  if (alongL > 400 || (alongL >= 0 && Math.abs(acrossL) > 150)) {
    altTarget = 120; // overshot or off to the side: climb and come back
  } else if (alongL < 0) {
    // Glidepath by straight-line distance to the threshold, so a plane
    // still converging from the side stays above the cone.
    altTarget = Math.max(6, distT * 0.055, distT > 250 ? groundHere + 25 : 0);
  } else {
    altTarget = 6; // over the runway: descend to land
  }
  const altErr = altTarget - f.y;
  let pitch = clamp(altErr / 40, -1, 1) * 0.7;
  // Hold about stall+8 on final: throttle feedback against speed.
  let throttle = clamp(0.55 + (f.plane.stall + 8 - f.speed) * 0.04, 0.3, 0.9);
  if (f.y < 12 && alongL > -50 && Math.abs(acrossL) < 100) {
    pitch = 0.05;
    throttle = 0.4;
  }
  return { pitch, roll: turn, throttle };
}

export function stageShot(name, flight) {
  if (name === 'title') {
    const f = createFlight({ seed: flight.seed, planeId: flight.planeId, missionId: 1 });
    f.phase = 'parked';
    return { flight: f, screen: 'title' };
  }
  if (name === 'approach') {
    const f = createAirborne({ seed: flight.seed, planeId: flight.planeId, missionId: 1, altitude: 150, speed: 24 });
    // Reposition onto final approach, 1200 units out, lined up.
    const dest = f.dest;
    const rad = (dest.hdg * Math.PI) / 180;
    f.x = dest.x - Math.sin(rad) * 1200;
    f.z = dest.z + Math.cos(rad) * 1200;
    f.heading = dest.hdg;
    f.y = 150;
    f.gear = true;
    f.flaps = true;
    runSteps(f, 9, (s) => autopilotTo(s, dest.x, 40, dest.z, s.plane.stall + 6));
    return { flight: f, screen: 'flying' };
  }
  if (name === 'debrief') {
    const f = createFlight({ seed: flight.seed, planeId: flight.planeId, missionId: 1 });
    runSteps(f, 420, autopilotMission);
    if (!f.complete && !f.crashed) {
      // Fast-forward: the pilot made it. Place the plane on the runway
      // rolling out and let the real landing logic finish the job.
      const dest = f.dest;
      const rad = (dest.hdg * Math.PI) / 180;
      f.x = dest.x;
      f.z = dest.z;
      f.y = 0;
      f.heading = dest.hdg;
      f.speed = 8;
      f.throttle = 0;
      f.gear = true;
      f.rings.forEach((r) => {
        if (!r.hit) {
          r.hit = true;
          f.stats.ringsHit += 1;
        }
      });
      runSteps(f, 30, () => ({ pitch: 0, roll: 0, throttle: 0 }));
    }
    if (!f.complete && !f.crashed) {
      f.complete = true;
      f.phase = 'done';
      f.stars = 2;
      f.earned = f.mission.pay;
      f.cash += f.earned;
      f.events.push('Mission complete');
    }
    return { flight: f, screen: 'debrief' };
  }
  // Default: 'flight' — the cover shot, mid-route through the rings.
  const f = createAirborne({ seed: flight.seed, planeId: flight.planeId, missionId: 3, altitude: 230, speed: 27 });
  runSteps(f, 26, (s) => {
    const ring = s.rings.find((r) => !r.hit);
    if (ring) return autopilotTo(s, ring.x, ring.y, ring.z, s.plane.maxSpeed * 0.85);
    return autopilotTo(s, s.dest.x, 230, s.dest.z, s.plane.maxSpeed * 0.85);
  });
  return { flight: f, screen: 'flying' };
}
