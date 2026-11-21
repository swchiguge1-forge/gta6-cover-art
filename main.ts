// Neon Coast Cover Studio — entrypoint for make.fun's gta6-cover-art-01.
// Written for this submission. What it does, in order:
//   1. checks the deliverable is complete (app/index.html present, 1-4
//      screenshots, each within the size the scorer allows),
//   2. stages a clean copy of app/ and screenshots/ into the output folder,
//   3. asks the vendored make.fun library to summarise that staged copy as
//      dossier.json, the file the judge reads.
// The app itself is plain static files (app/index.html plus ES modules) that
// run offline in a desktop browser: four poster layouts, five colour grades,
// three title styles, PNG export at three sizes. No build step, no network.
// Local check: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Local preview: node serve.ts, then http://localhost:8080

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// Limits the scorer enforces (its reference/gate.json). Only text_max_bytes
// changes the dossier bytes; the rest are pre-flight guards so a bad entry
// fails loudly here instead of at grading time.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
} as const;

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);

function abort(message: string): never {
  throw new Error(`Neon Coast Cover Studio: ${message}`);
}

// Count every file below a directory, recursively, so the run summary can
// say how much was staged.
function countFilesBelow(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    total += entry.isDirectory() ? countFilesBelow(full) : 1;
  }
  return total;
}

function listImages(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => IMAGE_EXTENSIONS.has(name.slice(name.lastIndexOf('.')).toLowerCase()))
    .sort();
}

function main(): void {
  const repoRoot = fileURLToPath(new URL('.', import.meta.url));
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  const appDir = join(repoRoot, 'app');
  const shotsDir = join(repoRoot, 'screenshots');

  // 1. Pre-flight: the deliverable must be complete before anything is staged.
  if (!existsSync(join(appDir, 'index.html'))) {
    abort('app/index.html is missing — the cover studio cannot be handed in without it');
  }
  if (!existsSync(shotsDir)) {
    abort('screenshots/ is missing — the entry needs 1 to 4 screenshots');
  }
  const shots = listImages(shotsDir);
  if (shots.length === 0) {
    abort('screenshots/ holds no JPG or PNG file — the entry needs 1 to 4 screenshots');
  }
  if (shots.length > CAPS.screenshots.max) {
    abort(`screenshots/ holds ${shots.length} images, but the scorer takes at most ${CAPS.screenshots.max}`);
  }
  for (const name of shots) {
    const bytes = statSync(join(shotsDir, name)).size;
    if (bytes > CAPS.screenshots.max_bytes) {
      abort(`${name} is ${bytes} bytes, over the ${CAPS.screenshots.max_bytes} byte screenshot cap`);
    }
  }

  // 2. Stage a clean copy: wipe any stale output first so nothing from an
  // earlier run can leak into the dossier. Clear the output folder's
  // contents, never the folder itself: in the grader the output folder is
  // a mount point whose parent is read-only, so removing it fails.
  mkdirSync(outDir, { recursive: true });
  for (const entry of readdirSync(outDir)) {
    rmSync(join(outDir, entry), { recursive: true, force: true });
  }
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });
  cpSync(appDir, join(outDir, 'app'), { recursive: true });
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
  const stagedAppFiles = countFilesBelow(join(outDir, 'app'));

  // 3. Summarise the staged copy for the judge.
  const dossier = buildDossier(outDir, {
    text_max_bytes: CAPS.text_max_bytes,
    screenshots: { max: CAPS.screenshots.max, max_bytes: CAPS.screenshots.max_bytes },
    app_max_files: CAPS.app_max_files,
    app_max_bytes: CAPS.app_max_bytes,
    app_path_max_bytes: CAPS.app_path_max_bytes,
  });
  const dossierPath = join(outDir, 'dossier.json');
  writeFileSync(dossierPath, dossier);

  console.log(
    JSON.stringify({
      staged: `${stagedAppFiles} app files`,
      screenshots: shots,
      dossier_bytes: dossier.byteLength,
      output: outDir,
    }),
  );
}

main();
