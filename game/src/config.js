// Sky Courier — game data: airports, planes, missions, palettes.
// Everything here is hand-authored original content for this game.
// Units: 1 game unit = 5 m. Speeds are units/second; the HUD converts to
// knots (x9.72) and feet (x16.4) for display. The world spans about
// +/-8000 units; a typical delivery leg takes 2-4 minutes of flying.

export const WORLD = {
  seed: 20261126,
  halfSize: 8200,
  // Terrain: rolling hills up to ~70 units, mountain ring past radius 6400.
  hillAmp: 64,
  mountainAmp: 420,
  mountainRadius: 6400,
  // Runways are flattened to sea level inside this radius of an airport.
  flatRadius: 700,
  runwayLength: 620,
  runwayWidth: 46,
  // Flight envelope.
  gravitySink: 6.5, // units/s^2 of sink when there is no lift
  maxPitchDeg: 28,
  maxRollDeg: 68,
  // Money.
  startCash: 1200,
};

// Twelve airports. x/z are world coordinates, hdg is the runway heading
// in degrees (0 = north, 90 = east). elev is always 0: every runway sits
// on flattened ground at sea level, so landings are fair everywhere.
export const AIRPORTS = [
  { code: 'SKY', name: 'Skyport Central', x: 0, z: 0, hdg: 90, town: true },
  { code: 'BAY', name: 'Bayfield', x: 4200, z: -1800, hdg: 140, town: true },
  { code: 'MTN', name: 'Mountview', x: -3500, z: -3200, hdg: 20, town: false },
  { code: 'ISL', name: 'Island Bay', x: -5200, z: 2400, hdg: 270, town: true },
  { code: 'DST', name: 'Dust Flats', x: 5200, z: 3600, hdg: 180, town: false },
  { code: 'FOR', name: 'Forest Gate', x: -1800, z: 5200, hdg: 60, town: false },
  { code: 'HAR', name: 'Harbor Town', x: 2800, z: 5600, hdg: 320, town: true },
  { code: 'GLC', name: 'Glacier Pass', x: -6400, z: -800, hdg: 100, town: false },
  { code: 'SUN', name: 'Sunset Strip', x: 6400, z: -4200, hdg: 240, town: false },
  { code: 'LAK', name: 'Lakeshore', x: -900, z: -5200, hdg: 0, town: true },
  { code: 'CIT', name: 'Citadel', x: -2800, z: 1800, hdg: 200, town: true },
  { code: 'FAR', name: 'Farpoint', x: 1500, z: -6800, hdg: 80, town: false },
];

// Six flyable planes. price 0 = owned from the start. turn is degrees/s
// at full bank, climb is units/s at full throttle, stall is the speed
// below which the wing stops flying.
export const PLANES = [
  { id: 'sparrow', name: 'Sparrow K-1', role: 'Trainer', price: 0,
    maxSpeed: 30, climb: 7, turn: 26, fuel: 100, cargo: 2, stall: 13,
    colors: { body: '#e8b64c', stripe: '#c0392b', trim: '#2c3e50' },
    blurb: 'Forgiving trainer. Light, honest, free.' },
  { id: 'mule', name: 'Mule C-2', role: 'Cargo', price: 2600,
    maxSpeed: 32, climb: 6, turn: 22, fuel: 140, cargo: 6, stall: 14,
    colors: { body: '#7f8c8d', stripe: '#f39c12', trim: '#2c3e50' },
    blurb: 'Workhorse freighter. Hauls the heavy loads.' },
  { id: 'swift', name: 'Swift F-3', role: 'Interceptor', price: 5200,
    maxSpeed: 46, climb: 11, turn: 34, fuel: 90, cargo: 1, stall: 17,
    colors: { body: '#2980b9', stripe: '#ecf0f1', trim: '#1a252f' },
    blurb: 'Fastest in the fleet. Drinks fuel like water.' },
  { id: 'glider', name: 'Albatross A-4', role: 'Long range', price: 4800,
    maxSpeed: 34, climb: 6, turn: 20, fuel: 220, cargo: 3, stall: 12,
    colors: { body: '#ecf0f1', stripe: '#16a085', trim: '#2c3e50' },
    blurb: 'Huge tanks. Cross the whole map on one fill.' },
  { id: 'bush', name: 'Heron H-5', role: 'STOL bush', price: 3400,
    maxSpeed: 28, climb: 9, turn: 30, fuel: 110, cargo: 3, stall: 9,
    colors: { body: '#27ae60', stripe: '#f1c40f', trim: '#1e8449' },
    blurb: 'Short-field specialist. Lands almost anywhere.' },
  { id: 'heavy', name: 'Condor C-6', role: 'Heavy lift', price: 9000,
    maxSpeed: 36, climb: 5, turn: 18, fuel: 180, cargo: 10, stall: 16,
    colors: { body: '#8e44ad', stripe: '#f39c12', trim: '#2c3e50' },
    blurb: 'The big one. Ten crates, one trip, big pay.' },
];

// Mission table: [type, fromCode, toCode, pay, minutes, weather, rings]
// 40 missions, difficulty rising with the row number. Types:
//   deliver — carry cargo from A to B and land there
//   rings   — fly the ring course, then land at the destination
//   time    — delivery against a tight clock (bonus for early arrival)
//   tour    — sightseeing: pass every waypoint, then land anywhere home
//   storm   — delivery in heavy weather with gusts and low cloud
const MISSION_ROWS = [
  ['deliver', 'SKY', 'BAY', 320, 8, 'clear', 0],
  ['deliver', 'SKY', 'FOR', 340, 8, 'clear', 0],
  ['rings', 'SKY', 'SKY', 300, 7, 'clear', 6],
  ['deliver', 'BAY', 'HAR', 360, 8, 'clear', 0],
  ['time', 'SKY', 'CIT', 420, 5, 'clear', 0],
  ['tour', 'SKY', 'SKY', 380, 9, 'clear', 4],
  ['deliver', 'FOR', 'MTN', 400, 9, 'cloud', 0],
  ['rings', 'BAY', 'BAY', 380, 7, 'clear', 8],
  ['deliver', 'CIT', 'ISL', 460, 9, 'clear', 0],
  ['time', 'BAY', 'DST', 520, 6, 'cloud', 0],
  ['deliver', 'HAR', 'FOR', 480, 9, 'cloud', 0],
  ['storm', 'SKY', 'MTN', 620, 10, 'storm', 0],
  ['rings', 'MTN', 'MTN', 520, 8, 'cloud', 10],
  ['deliver', 'ISL', 'GLC', 560, 10, 'cloud', 0],
  ['tour', 'BAY', 'BAY', 540, 10, 'clear', 5],
  ['time', 'CIT', 'LAK', 600, 6, 'clear', 0],
  ['deliver', 'DST', 'SUN', 580, 9, 'dusk', 0],
  ['rings', 'HAR', 'HAR', 600, 8, 'dusk', 10],
  ['deliver', 'GLC', 'FAR', 680, 11, 'storm', 0],
  ['storm', 'FOR', 'GLC', 780, 11, 'storm', 0],
  ['deliver', 'SUN', 'DST', 640, 9, 'dusk', 0],
  ['time', 'ISL', 'HAR', 720, 7, 'cloud', 0],
  ['tour', 'MTN', 'MTN', 700, 11, 'dusk', 6],
  ['rings', 'LAK', 'LAK', 680, 8, 'clear', 12],
  ['deliver', 'FAR', 'SUN', 760, 11, 'dusk', 0],
  ['storm', 'GLC', 'MTN', 900, 12, 'storm', 0],
  ['deliver', 'HAR', 'ISL', 720, 10, 'cloud', 0],
  ['time', 'DST', 'FAR', 820, 7, 'dusk', 0],
  ['rings', 'SUN', 'SUN', 780, 9, 'dusk', 12],
  ['deliver', 'LAK', 'CIT', 700, 10, 'clear', 0],
  ['tour', 'GLC', 'GLC', 820, 12, 'storm', 6],
  ['time', 'FAR', 'BAY', 900, 8, 'cloud', 0],
  ['storm', 'SUN', 'GLC', 1100, 13, 'storm', 0],
  ['deliver', 'MTN', 'DST', 860, 12, 'dusk', 0],
  ['rings', 'FAR', 'FAR', 880, 9, 'storm', 14],
  ['time', 'HAR', 'SKY', 840, 7, 'clear', 0],
  ['tour', 'ISL', 'ISL', 900, 12, 'dusk', 7],
  ['storm', 'LAK', 'GLC', 1200, 13, 'storm', 0],
  ['deliver', 'CIT', 'FAR', 980, 12, 'cloud', 0],
  ['rings', 'SKY', 'SKY', 1000, 10, 'dusk', 16],
];

const TYPE_NAMES = {
  deliver: 'Cargo Delivery',
  rings: 'Ring Course',
  time: 'Express Run',
  tour: 'Sightseeing Tour',
  storm: 'Storm Run',
};

const TYPE_BLURBS = {
  deliver: 'Pick up the crates and put them down gently at the destination.',
  rings: 'Thread every ring, then bring her home to the runway.',
  time: 'The clock is the cargo. Early arrival pays double.',
  tour: 'Fly over every waypoint and enjoy the view, then land.',
  storm: 'Heavy weather, hard gusts. Only steady hands get paid.',
};

export function buildMissions() {
  return MISSION_ROWS.map((row, i) => {
    const [type, from, to, pay, minutes, weather, rings] = row;
    const fromA = AIRPORTS.find((a) => a.code === from);
    const toA = AIRPORTS.find((a) => a.code === to);
    const title = type === 'rings' || type === 'tour'
      ? `${TYPE_NAMES[type]} over ${fromA.name}`
      : `${TYPE_NAMES[type]}: ${fromA.name} → ${toA.name}`;
    return {
      id: i + 1,
      type,
      title,
      blurb: TYPE_BLURBS[type],
      from,
      to,
      pay,
      timeLimit: minutes * 60,
      weather,
      rings,
      // Stars need: finish + (rings all hit) + (time under 70% of limit).
      unlocked: i === 0,
    };
  });
}

// Weather presets: wind vector (units/s), gust strength, cloud cover
// 0-1, rain 0-1, light level 0-1, label.
export const WEATHER = {
  clear: { wind: [2, 0], gust: 0, cloud: 0.15, rain: 0, light: 1.0, label: 'Clear skies' },
  cloud: { wind: [5, 2], gust: 1.5, cloud: 0.55, rain: 0, light: 0.85, label: 'Scattered cloud' },
  dusk: { wind: [3, -2], gust: 1, cloud: 0.3, rain: 0, light: 0.55, label: 'Dusk' },
  storm: { wind: [9, 5], gust: 5, cloud: 0.9, rain: 0.8, light: 0.45, label: 'Storm' },
};

// Sky palettes by light level, lerped in the renderer. Each entry:
// [top sky, horizon sky, ground haze, sun color]
export const SKY = {
  day: ['#2f6fb2', '#a8c8e0', '#c8d8c0', '#fff3c4'],
  dusk: ['#3a2f5e', '#e08a4c', '#d8a078', '#ff9a3c'],
  storm: ['#3a4148', '#7a8288', '#8a9494', '#d8d8d8'],
};

// Terrain colors sampled by the ground renderer. [base, variation]
export const TERRAIN_COLORS = {
  field: ['#6da24a', '#5d8f3e'],
  meadow: ['#7fae56', '#6f9e48'],
  forest: ['#3d6b34', '#33592c'],
  sand: ['#cbb37a', '#bfa66a'],
  water: ['#3a6ea8', '#34619a'],
  town: ['#8a8a7a', '#7a7a6a'],
  rock: ['#7a7568', '#6a6558'],
  snow: ['#dfe8ee', '#cfdae2'],
  runway: ['#3a3d42', '#33363b'],
};

export const GAME_NAME = 'Sky Courier';
export const GAME_TAGLINE = '12 Airports · 6 Planes · 40 Missions';
export const GAME_VERSION = '1.0.0';
