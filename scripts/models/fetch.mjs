#!/usr/bin/env node
/**
 * Fetch the pose models and the MediaPipe runtime into the web app.
 *
 * Kinetrace self-hosts everything the core loop needs, so a running install
 * talks to no third party. The Vercel build runs this before `vite build`.
 *
 *   node scripts/models/fetch.mjs                     fetch and verify
 *   node scripts/models/fetch.mjs --update-checksums  record new checksums
 *   node scripts/models/fetch.mjs --only full         fetch a single variant
 *
 * Optional models for the sheet import and voice commands are not fetched
 * here: they are large, the core loop does not need them, and the app
 * downloads them on demand with the size shown first.
 */

import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const publicDir = join(root, 'apps', 'web', 'public');
const checksumFile = join(root, 'scripts', 'models', 'checksums.json');

const BASE = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker';

const MODELS = [
  {
    name: 'lite',
    url: `${BASE}/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
    file: 'models/pose_landmarker_lite.task',
  },
  {
    name: 'full',
    url: `${BASE}/pose_landmarker_full/float16/1/pose_landmarker_full.task`,
    file: 'models/pose_landmarker_full.task',
  },
  {
    name: 'heavy',
    url: `${BASE}/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task`,
    file: 'models/pose_landmarker_heavy.task',
  },
];

const args = process.argv.slice(2);
const updateChecksums = args.includes('--update-checksums');
const onlyIndex = args.indexOf('--only');
const only = onlyIndex >= 0 ? args[onlyIndex + 1] : undefined;

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function loadChecksums() {
  if (!existsSync(checksumFile)) return {};
  return JSON.parse(await readFile(checksumFile, 'utf8'));
}

async function fetchModel(model, checksums) {
  const target = join(publicDir, model.file);
  const expected = checksums[model.name];

  if (existsSync(target) && expected) {
    const actual = sha256(await readFile(target));
    if (actual === expected) {
      console.log(`✓ ${model.name} already present`);
      return null;
    }
    console.warn(`! ${model.name} checksum mismatch, re-downloading`);
  }

  console.log(`… downloading ${model.name} from ${model.url}`);
  const response = await fetch(model.url);
  if (!response.ok) throw new Error(`${model.name}: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const actual = sha256(buffer);

  if (expected && actual !== expected && !updateChecksums) {
    throw new Error(
      `${model.name}: checksum mismatch.\n  expected ${expected}\n  got      ${actual}\n` +
        'Run with --update-checksums only if you trust the new file.',
    );
  }

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, buffer);
  console.log(`✓ ${model.name} ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);
  return actual;
}

async function copyMediapipeRuntime() {
  // pnpm does not hoist by default, so look in the app's own node_modules first.
  const candidates = [
    join(root, 'apps', 'web', 'node_modules', '@mediapipe', 'tasks-vision', 'wasm'),
    join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm'),
  ];
  const source = candidates.find((candidate) => existsSync(candidate));
  if (!source) {
    console.warn('! MediaPipe runtime not found; run pnpm install first');
    return;
  }
  const target = join(publicDir, 'mediapipe', 'wasm');
  await mkdir(target, { recursive: true });
  await cp(source, target, { recursive: true });
  console.log('✓ MediaPipe runtime copied to public/mediapipe/wasm');
}

const checksums = await loadChecksums();
const updated = { ...checksums };
let failures = 0;

for (const model of MODELS) {
  if (only && model.name !== only) continue;
  try {
    const hash = await fetchModel(model, checksums);
    if (hash) updated[model.name] = hash;
  } catch (error) {
    failures += 1;
    console.error(`✗ ${error.message}`);
  }
}

await copyMediapipeRuntime();

if (updateChecksums) {
  await writeFile(checksumFile, `${JSON.stringify(updated, null, 2)}\n`);
  console.log(`✓ checksums written to ${checksumFile}`);
}

if (failures > 0) {
  console.error(`\n${failures} model(s) could not be fetched.`);
  process.exit(1);
}
