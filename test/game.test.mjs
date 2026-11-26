// Sky Courier — logic tests. Run with: node --test test/game.test.mjs
// Everything here imports the pure modules only (config, random, world,
// shots): no DOM, no canvas, no Audio, so the suite runs in plain Node.

import test from 'node:test';
import assert from 'node:assert/strict';
import { AIRPORTS, PLANES, WORLD, buildMissions } from '../game/src/config.js';
import { mulberry32, noise2, hash2 } from '../game/src/random.js';
import {
  STEP,
  airportByCode,
  bearingTo,
  createAirborne,
  createFlight,
  runwayCoords,
  stateFingerprint,
  stepFlight,
  terrainHeight,
  terrainKind,
} from '../game/src/world.js';
import { autopilotMission, stageShot } from '../game/src/shots.js';

const SEED = WORLD.seed;

test('random: same seed, same sequence', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 50; i += 1) assert.equal(a(), b());
  assert.notEqual(mulberry32(1)(), mulberry32(2)());
  assert.equal(noise2(3.5, 7.25, SEED), noise2(3.5, 7.25, SEED));
  assert.equal(hash2(10, -4, SEED), hash2(10, -4, SEED));
});

test('config: 12 airports, 6 planes, 40 missions', () => {
  assert.equal(AIRPORTS.length, 12);
  assert.equal(PLANES.length, 6);
  const missions = buildMissions();
  assert.equal(missions.length, 40);
  missions.forEach((m, i) => {
    assert.equal(m.id, i + 1);
    assert.ok(m.pay > 0);
    assert.ok(m.timeLimit > 0);
    assert.ok(airportByCode(m.from));
    assert.ok(airportByCode(m.to));
  });
  assert.equal(PLANES[0].price, 0, 'first plane is free');
  assert.ok(PLANES.every((p) => p.stall < p.maxSpeed));
});

test('terrain: airports are flat, lakes are low, mountains are high', () => {
  for (const a of AIRPORTS) {
    assert.ok(Math.abs(terrainHeight(a.x, a.z, SEED)) < 0.01, `${a.code} flat`);
    assert.equal(terrainKind(a.x, a.z, SEED), 'field');
  }
  assert.ok(terrainHeight(-900, -6400, SEED) < 0, 'Lakeshore lake is below sea level');
  assert.equal(terrainKind(-900, -6400, SEED), 'water');
  assert.ok(terrainHeight(7800, 0, SEED) > 150, 'mountain ring is high');
  assert.equal(terrainHeight(123, -456, SEED), terrainHeight(123, -456, SEED));
});

test('runway geometry: centreline reads zero across-track', () => {
  const a = airportByCode('SKY');
  const { along, across } = runwayCoords(a, a.x, a.z);
  assert.ok(Math.abs(along) < 0.01);
  assert.ok(Math.abs(across) < 0.01);
});

test('flight model: level cruise holds altitude', () => {
  const f = createAirborne({ seed: SEED, missionId: 1, altitude: 220, speed: 26 });
  const y0 = f.y;
  for (let i = 0; i < 600; i += 1) stepFlight(f, { pitch: 0, roll: 0, throttle: 0.75 }, STEP);
  assert.ok(Math.abs(f.y - y0) < 25, `altitude drifted ${f.y - y0}`);
  assert.ok(f.speed > f.plane.stall);
  assert.ok(!f.crashed);
});

test('flight model: banking turns the heading', () => {
  const f = createAirborne({ seed: SEED, missionId: 1, altitude: 220, speed: 26 });
  const h0 = f.heading;
  for (let i = 0; i < 300; i += 1) stepFlight(f, { pitch: 0, roll: 1, throttle: 0.75 }, STEP);
  const turned = ((f.heading - h0 + 540) % 360) - 180;
  assert.ok(turned > 20, `turned only ${turned} degrees`);
});

test('flight model: below stall speed the plane sinks', () => {
  const f = createAirborne({ seed: SEED, missionId: 1, altitude: 220, speed: 10 });
  const y0 = f.y;
  for (let i = 0; i < 480; i += 1) stepFlight(f, { pitch: 0.5, roll: 0, throttle: 0.2 }, STEP);
  assert.ok(f.y < y0 - 20, `should have sunk, y=${f.y} vs ${y0}`);
});

test('flight model: throttle changes speed, fuel burns out', () => {
  const f = createAirborne({ seed: SEED, missionId: 1, altitude: 220, speed: 20 });
  const fuel0 = f.fuel;
  for (let i = 0; i < 600; i += 1) stepFlight(f, { pitch: 0, roll: 0, throttle: 1 }, STEP);
  assert.ok(f.speed > 20, 'full throttle should accelerate');
  assert.ok(f.fuel < fuel0, 'fuel should burn');
  const g = createAirborne({ seed: SEED, missionId: 1, altitude: 220, speed: 26 });
  g.fuel = 0.01;
  for (let i = 0; i < 600; i += 1) stepFlight(g, { pitch: 0, roll: 0, throttle: 1 }, STEP);
  assert.ok(g.throttle < 0.05, 'empty tanks cut the engine');
});

test('rings: flying through one scores', () => {
  const f = createAirborne({ seed: SEED, missionId: 3, altitude: 230, speed: 26 });
  assert.ok(f.rings.length >= 6);
  const ring = f.rings[0];
  f.x = ring.x;
  f.y = ring.y;
  f.z = ring.z;
  const score0 = f.score;
  stepFlight(f, { pitch: 0, roll: 0, throttle: 0.75 }, STEP);
  assert.ok(ring.hit);
  assert.equal(f.score, score0 + 150);
});

test('crash: flying into a hillside ends the flight', () => {
  const f = createAirborne({ seed: SEED, missionId: 1, altitude: 30, speed: 26 });
  f.x = 7800;
  f.z = 0;
  f.y = 20;
  f.heading = 90;
  for (let i = 0; i < 600 && !f.crashed; i += 1) stepFlight(f, { pitch: 0, roll: 0, throttle: 0.75 }, STEP);
  assert.ok(f.crashed, 'should have hit the mountain ring');
  assert.ok(f.crashReason.length > 0);
});

test('crash: gear-up landing on a runway', () => {
  const f = createFlight({ seed: SEED, missionId: 1 });
  const dest = airportByCode('BAY');
  f.x = dest.x;
  f.z = dest.z;
  f.y = 4;
  f.heading = dest.hdg;
  f.speed = 18;
  f.gear = false;
  f.airborne = true;
  for (let i = 0; i < 600 && !f.crashed; i += 1) {
    stepFlight(f, { pitch: -0.5, roll: 0, throttle: 0 }, STEP);
  }
  assert.ok(f.crashed);
  assert.match(f.crashReason, /gear/i);
});

test('determinism: same inputs, same fingerprint', () => {
  function run() {
    const f = createAirborne({ seed: SEED, missionId: 1, altitude: 220, speed: 26 });
    for (let i = 0; i < 1200; i += 1) {
      stepFlight(f, { pitch: Math.sin(i / 90) * 0.4, roll: Math.cos(i / 120) * 0.6, throttle: 0.75 }, STEP);
    }
    return stateFingerprint(f);
  }
  assert.equal(run(), run());
});

test('mission: autopilot flies delivery 1 to completion', () => {
  const f = createFlight({ seed: SEED, missionId: 1 });
  let steps = 0;
  while (!f.complete && !f.crashed && steps < 60 * 600) {
    stepFlight(f, autopilotMission(f), STEP);
    steps += 1;
  }
  assert.ok(!f.crashed, `crashed: ${f.crashReason}`);
  assert.ok(f.complete, 'mission 1 should complete');
  assert.ok(f.earned > 0);
  assert.ok(f.stars >= 1 && f.stars <= 3);
});

test('shots: all four scenes stage without crashing', () => {
  for (const name of ['flight', 'approach', 'title', 'debrief']) {
    const base = createFlight({ seed: SEED, missionId: 1 });
    const { flight, screen } = stageShot(name, base);
    assert.ok(flight, `${name} stages a flight`);
    assert.ok(['flying', 'title', 'debrief'].includes(screen), `${name} -> ${screen}`);
    assert.ok(!flight.crashed || name === 'debrief', `${name} should not crash`);
  }
  const deb = stageShot('debrief', createFlight({ seed: SEED, missionId: 1 }));
  assert.ok(deb.flight.complete, 'debrief shot ends with a completed mission');
});
