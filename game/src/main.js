// Sky Courier — game shell: boot, screens, loop, saves.
// Owns the profile (cash, planes, stars), the screen state machine and
// the animation loop. Rendering lives in render.js, physics in world.js.

import { GAME_NAME, PLANES, buildMissions } from './config.js';
import { createAirborne, createFlight, stepFlight, STEP, airportByCode, bearingTo } from './world.js';
import { renderFrame } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { angleDiffDeg, clamp } from './random.js';

const SAVE_KEY = 'sky-courier-save-v1';

function defaultProfile() {
  return {
    cash: 1200,
    owned: ['sparrow'],
    planeId: 'sparrow',
    stars: {},
    unlocked: [1],
    best: 0,
    missionPage: 0,
  };
}

function loadProfile() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultProfile();
    const p = JSON.parse(raw);
    return { ...defaultProfile(), ...p };
  } catch {
    return defaultProfile();
  }
}

function saveProfile(profile) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(profile));
  } catch {
    // Private mode or hosted without storage: the game still plays.
  }
}

function nextMissionId(profile, missions) {
  const open = missions.find((m) => (profile.unlocked.includes(m.id)) && (profile.stars[m.id] ?? 0) < 3);
  return open ? open.id : 1;
}

export function boot() {
  const canvas = document.getElementById('game');
  const statusEl = document.getElementById('status');
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  const seed = Number(params.get('seed') || '1') || 1;

  const missions = buildMissions();
  const profile = loadProfile();
  profile.missions = missions;
  profile.planes = PLANES;

  const input = createInput(canvas);
  const audio = createAudio();
  let W = 0;
  let H = 0;
  let dpr = 1;

  function resize() {
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // Demo flight behind the menus: a slow sightseeing orbit over Skyport.
  let demo = createAirborne({ seed, planeId: profile.planeId, missionId: 1, altitude: 260, speed: 24 });
  let demoAngle = 0;
  function stepDemo(dt) {
    demoAngle += dt * 0.02;
    const tx = Math.cos(demoAngle) * 2600;
    const tz = Math.sin(demoAngle) * 2600;
    const bearing = bearingTo(demo, tx, tz);
    const turn = clamp(angleDiffDeg(bearing, demo.heading) / 30, -1, 1);
    stepFlight(demo, { pitch: clamp((240 - demo.y) / 90, -1, 1) * 0.6, roll: turn, throttle: 0.65 }, dt);
    if (demo.crashed || demo.complete) demo = createAirborne({ seed, planeId: profile.planeId, missionId: 1, altitude: 260, speed: 24 });
  }

  // ---- shot mode: one deterministic frame, then stop -------------------
  if (shot) {
    const base = createFlight({ seed, planeId: profile.planeId, missionId: 1 });
    const staged = stageShot(shot, base);
    const model = {
      screen: staged.screen === 'debrief' ? 'flying' : staged.screen,
      flight: staged.flight,
      profile,
      time: 10,
      mouse: { x: -1, y: -1 },
      click: null,
      demo: staged.flight,
      briefingMission: missions[0],
    };
    if (staged.screen === 'title') model.screen = 'title';
    // Render now, and again on the next frame and on any resize:
    // resizing a canvas clears it, and headless screenshot runs can
    // fire a resize after the first paint.
    const renderShot = () => renderFrame(ctx, W, H, model);
    renderShot();
    window.addEventListener('resize', renderShot);
    requestAnimationFrame(renderShot);
    document.title = `${GAME_NAME} — shot ${shot}`;
    return;
  }

  // ---- interactive mode -------------------------------------------------
  let screen = 'title';
  let flight = null;
  let briefingMission = missions[0];
  let time = 0;
  let last = performance.now();
  let endedSound = false;
  let lastAlarm = 0;

  function startMission(id) {
    flight = createFlight({ seed, planeId: profile.planeId, missionId: id, cash: profile.cash });
    input.setThrottle(0);
    screen = 'flying';
    endedSound = false;
    audio.unlock();
  }

  function act(id) {
    if (!id) return;
    audio.unlock();
    audio.click();
    const [kind, arg] = id.split(':');
    if (kind === 'fly') {
      startMission(nextMissionId(profile, missions));
    } else if (kind === 'hangar') {
      screen = 'hangar';
    } else if (kind === 'missions') {
      screen = 'missions';
    } else if (kind === 'howto') {
      screen = 'howto';
    } else if (kind === 'back' || kind === 'title') {
      screen = 'title';
    } else if (kind === 'select') {
      profile.planeId = arg;
      saveProfile(profile);
    } else if (kind === 'buy') {
      const pl = PLANES.find((p) => p.id === arg);
      if (pl && profile.cash >= pl.price) {
        profile.cash -= pl.price;
        profile.owned.push(pl.id);
        profile.planeId = pl.id;
        saveProfile(profile);
      }
    } else if (kind === 'mission') {
      briefingMission = missions.find((m) => m.id === Number(arg));
      screen = 'briefing';
    } else if (kind === 'start-mission') {
      startMission(briefingMission.id);
    } else if (kind === 'page-prev') {
      profile.missionPage = Math.max(0, (profile.missionPage || 0) - 1);
    } else if (kind === 'page-next') {
      profile.missionPage = (profile.missionPage || 0) + 1;
    } else if (kind === 'resume') {
      screen = 'flying';
    } else if (kind === 'restart') {
      startMission(flight.mission.id);
    } else if (kind === 'quit') {
      screen = 'title';
      flight = null;
    } else if (kind === 'retry') {
      startMission(flight.mission.id);
    } else if (kind === 'next') {
      const m = flight.mission;
      if (flight.complete && m.id < missions.length) {
        briefingMission = missions[m.id];
        screen = 'briefing';
      } else {
        screen = 'missions';
      }
    }
  }

  function frame(now) {
    const dt = clamp((now - last) / 1000, 0.001, 0.05);
    last = now;
    time += dt;
    const click = input.consumeClick();
    const model = {
      screen,
      flight: flight ?? demo,
      profile,
      time,
      mouse: input.mouse,
      click,
      demo,
      briefingMission,
    };
    if (screen === 'flying' && flight) {
      const inp = input.read(dt, W, H);
      for (const t of inp.toggles) {
        if (t === 'KeyP' || t === 'Escape') screen = 'pause';
        if (t === 'KeyG') flight.gear = !flight.gear;
        if (t === 'KeyF') flight.flaps = !flight.flaps;
      }
      if (screen === 'flying') {
        let acc = 0;
        while (acc < dt) {
          stepFlight(flight, { pitch: inp.pitch, roll: inp.roll, throttle: inp.throttle }, STEP);
          acc += STEP;
          if (flight.crashed || flight.complete || flight.landed) break;
        }
        audio.update({ throttle: flight.throttle, speed: flight.speed, maxSpeed: flight.plane.maxSpeed });
        if (flight.speed < flight.plane.stall && flight.y > 2 && time - lastAlarm > 1) {
          lastAlarm = time;
          audio.alarm();
        }
        if ((flight.crashed || flight.complete) && !endedSound) {
          endedSound = true;
          if (flight.crashed) audio.crash();
          else audio.complete();
          if (flight.complete) {
            profile.cash = flight.cash;
            profile.stars[flight.mission.id] = Math.max(profile.stars[flight.mission.id] ?? 0, flight.stars);
            if (flight.mission.id < missions.length && !profile.unlocked.includes(flight.mission.id + 1)) {
              profile.unlocked.push(flight.mission.id + 1);
            }
            profile.best = Math.max(profile.best, flight.score);
            saveProfile(profile);
          }
        }
        if (flight.landed && !flight.complete && !flight.crashed) {
          // Landed somewhere that is not the destination: end the sortie.
          flight.complete = false;
        }
        const alt = Math.round(flight.y * 16.4);
        const spd = Math.round(flight.speed * 9.72);
        statusEl.textContent = `${GAME_NAME}: altitude ${alt} feet, speed ${spd} knots, heading ${Math.round(flight.heading)} degrees. ${flight.mission.title}.`;
      }
    } else if (screen === 'pause' && flight) {
      // Still read input while paused so P / Esc can resume.
      const inp = input.read(dt, W, H);
      if (inp.toggles.includes('KeyP') || inp.toggles.includes('Escape')) screen = 'flying';
    } else {
      stepDemo(dt);
    }
    const hit = renderFrame(ctx, W, H, model);
    act(hit);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}
