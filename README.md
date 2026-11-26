# flight-game

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/xueren-ctrl/flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/xueren-ctrl/flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Sky Courier — a complete offline flight game: fly cargo between 12 airports in 6 planes across 40 missions, through rings, storms and sunsets. Chase-view 3D terrain, live instruments, fuel and damage that turn every sortie into decisions.

## Run it

```sh
node serve.ts
# then open http://localhost:8080 — or open game/index.html directly
```

No build step, no network: the game is plain static files under `game/`, all art and sound generated in code.

## The game

- **12 airports** on one hand-built map: Skyport Central, Bayfield, Mountview, Island Bay, Dust Flats, Forest Gate, Harbor Town, Glacier Pass, Sunset Strip, Lakeshore, Citadel and Farpoint — each with its own runway heading and terrain.
- **6 planes** to earn and fly: the free Sparrow trainer, the Mule freighter, the Swift interceptor, the long-range Albatross, the STOL Heron and the heavy Condor — each with its own speed, climb, turn, fuel and cargo.
- **40 missions** in 5 kinds: cargo delivery, ring courses, express runs against the clock, sightseeing tours and storm runs in heavy weather with gusts.
- **Real flying**: throttle and turn discipline, stall, fuel burn, flaps and gear, crosswinds, smooth-landing bonuses and crash landings that read as what happened.
- **Instruments that look flown**: airspeed, altitude and vertical speed, a compass tape, an artificial horizon, fuel and throttle gauges, gear and flap lights, stall and pull-up warnings.
- **Synthesised sound**: engine hum, wind, ring chimes and landing thuds, all made with WebAudio — no audio files.
- Progress saves in your browser: cash, planes, stars and unlocked missions.

## Controls

| Key | What it does |
| --- | --- |
| ↑ / W, ↓ / S | Pitch up / down |
| ← → / A D | Bank and turn |
| Shift / Ctrl | Throttle up / down |
| G | Landing gear |
| F | Flaps |
| M | Mouse steering |
| P / Esc | Pause |

## Files

- `main.ts` — the hand-in program: copies `game/` and `screenshots/` and writes `dossier.json`
- `game/index.html` — the game shell
- `game/src/config.js` — airports, planes, missions, weather
- `game/src/world.js` — terrain, flight physics, missions, scoring
- `game/src/render.js` — pseudo-3D chase view, HUD, aircraft, menus
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — synthesised sound
- `game/src/shots.js` — deterministic screenshot scenes
- `game/src/main.js` — boot, screens, loop, saves
- `test/game.test.mjs` — logic tests (`node --test test/game.test.mjs`)

---

<sub>Entered on [make.fun](https://make.fun/?ref=18rdet0v&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
