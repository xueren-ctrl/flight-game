// Sky Courier — hand-in program (Node 22, standard library only).
// It copies the game and its screenshots from beside this file into the
// output directory and writes dossier.json, the summary the judge reads,
// using the vendored make.fun library. It runs twice in the grader and
// both runs must write the same bytes, so there is no clock, no random
// number and no network call anywhere in here.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function sizeOfTree(dir) {
  let total = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    total += st.isDirectory() ? sizeOfTree(p) : st.size;
  }
  return total;
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's caps, from the kit's starter notes: at most 4 screenshots
// of 256 KiB each, at most 993 files and 48 MiB under game/, and no game
// path over 1000 bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

const shots = readdirSync(join(out, 'screenshots')).sort();
console.log(`Sky Courier handed in: ${shots.length} screenshot(s), game/ is ${sizeOfTree(join(out, 'game'))} bytes.`);
