#!/usr/bin/env node
/**
 * Generate `docs/demo.svg`: the far mode session screen, animated from the same
 * reference motion the library and the fixtures use.
 *
 * A recorded demo of a real session replaces this at the first release; until
 * then this at least shows what the screen looks like and moves the way the
 * engine sees a repetition.
 *
 *   pnpm docs:demo
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { POSTURES, SKELETON_BONES, poseToWorldPoints, samplePose } from '@kinetrace/engine';
import { getExercise } from '@kinetrace/exercises';

const root = fileURLToPath(new URL('../..', import.meta.url));
const exercise = getExercise('glute-bridge');
if (!exercise) throw new Error('glute-bridge is missing from the library');

const FRAMES = 30;
const CYCLE_SECONDS = exercise.reference.cycleSeconds;
const WIDTH = 720;
const HEIGHT = 405;
const INK = '#1b1a18';
const CANVAS = '#f7f5f2';
const ACCENT = '#d9702f';
const BAND = '#2c7a58';

/** Project world points into the SVG box, the way the app's stick figure does. */
function projectFrame(phase) {
  const pose = samplePose(exercise.reference, phase);
  const points = poseToWorldPoints(pose, POSTURES[exercise.reference.posture]);
  const flat = points.map((point) => ({ x: point.z, y: -point.y }));
  const xs = flat.map((point) => point.x);
  const ys = flat.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scale = 150 / Math.max(maxX - minX, maxY - minY, 1e-6);
  return flat.map((point) => ({
    x: 120 + (point.x - (minX + maxX) / 2) * scale,
    y: 230 + (point.y - (minY + maxY) / 2) * scale,
  }));
}

/** Hip angle of the reference motion at a position in the cycle. */
function hipAngle(phase) {
  return samplePose(exercise.reference, phase).left.hipAngle;
}

const band = exercise.targets.band;
const gaugeMin = exercise.targets.safety?.min ?? band.min - 30;
const gaugeMax = exercise.targets.safety?.max ?? band.max + 30;
const START_ANGLE = 150;
const SWEEP = 240;

function polar(cx, cy, radius, degrees) {
  const radians = (degrees * Math.PI) / 180;
  return [cx + radius * Math.cos(radians), cy + radius * Math.sin(radians)];
}

function gaugeAngle(value) {
  const clamped = Math.min(gaugeMax, Math.max(gaugeMin, value));
  return START_ANGLE + ((clamped - gaugeMin) / (gaugeMax - gaugeMin)) * SWEEP;
}

function arc(cx, cy, radius, from, to) {
  const [x1, y1] = polar(cx, cy, radius, from);
  const [x2, y2] = polar(cx, cy, radius, to);
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${radius} ${radius} 0 ${
    Math.abs(to - from) > 180 ? 1 : 0
  } 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

/** Keyframe timing shared by every animated element. */
const keyTimes = Array.from({ length: FRAMES }, (_, index) => (index / FRAMES).toFixed(4)).join(
  ';',
);
const duration = `${CYCLE_SECONDS}s`;

function animate(attribute, values) {
  return `<animate attributeName="${attribute}" values="${values.join(';')}" keyTimes="${keyTimes}" dur="${duration}" calcMode="discrete" repeatCount="indefinite"/>`;
}

const frames = Array.from({ length: FRAMES }, (_, index) => projectFrame(index / FRAMES));
const angles = Array.from({ length: FRAMES }, (_, index) => hipAngle(index / FRAMES));

const bones = SKELETON_BONES.map(([from, to]) => {
  const x1 = frames.map((frame) => frame[from].x.toFixed(1));
  const y1 = frames.map((frame) => frame[from].y.toFixed(1));
  const x2 = frames.map((frame) => frame[to].x.toFixed(1));
  const y2 = frames.map((frame) => frame[to].y.toFixed(1));
  const tracked = [23, 25, 11].includes(from) && [23, 25, 11].includes(to);
  return `<line x1="${x1[0]}" y1="${y1[0]}" x2="${x2[0]}" y2="${y2[0]}" stroke="${
    tracked ? ACCENT : CANVAS
  }" stroke-width="${tracked ? 7 : 5}" stroke-linecap="round">${animate('x1', x1)}${animate(
    'y1',
    y1,
  )}${animate('x2', x2)}${animate('y2', y2)}</line>`;
}).join('\n    ');

const needle = frames.map((_, index) => {
  const [x, y] = polar(520, 250, 70, gaugeAngle(angles[index]));
  return { x: x.toFixed(1), y: y.toFixed(1) };
});
const inBand = angles.map((value) => (value >= band.min && value <= band.max ? BAND : CANVAS));
// One repetition per cycle: the counter ticks as the hip reaches the band.
// SVG cannot animate text content, so both numbers are drawn and faded.
const counterValues = ['7', '8'];
const counterOpacity = counterValues.map((value) =>
  angles.map((angle) => ((angle >= band.min ? '8' : '7') === value ? '1' : '0')),
);
const counterText = counterValues
  .map(
    (value, index) =>
      `<text x="430" y="170" fill="${CANVAS}" font-family="system-ui, sans-serif" font-size="118" font-weight="600" text-anchor="middle" opacity="${counterOpacity[index][0]}">${value}${animate('opacity', counterOpacity[index])}</text>`,
  )
  .join('\n  ');

// The angle readout is the same trick: one text node per distinct value.
const angleValues = [...new Set(angles.map((value) => `${Math.round(value)}`))];
const angleText = angleValues
  .map((value) => {
    const opacity = angles.map((angle) => (`${Math.round(angle)}` === value ? '1' : '0'));
    return `<text x="520" y="330" fill="${CANVAS}" font-family="system-ui, sans-serif" font-size="30" font-weight="600" text-anchor="middle" opacity="${opacity[0]}">${value}°${animate('opacity', opacity)}</text>`;
  })
  .join('\n  ');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="Kinetrace far mode session screen: a glute bridge being counted">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${INK}"/>
  <text x="36" y="48" fill="${CANVAS}" font-family="system-ui, sans-serif" font-size="22" opacity="0.75">Puente de glúteos · serie 2 de 3</text>

  <g>
    ${bones}
  </g>

  ${counterText}
  <text x="430" y="205" fill="${CANVAS}" font-family="system-ui, sans-serif" font-size="24" text-anchor="middle" opacity="0.6">/ 12 repeticiones</text>

  <path d="${arc(520, 250, 70, START_ANGLE, START_ANGLE + SWEEP)}" fill="none" stroke="#3a3833" stroke-width="16" stroke-linecap="round"/>
  <path d="${arc(520, 250, 70, gaugeAngle(band.min), gaugeAngle(band.max))}" fill="none" stroke="${BAND}" stroke-width="16"/>
  <circle cx="${needle[0].x}" cy="${needle[0].y}" r="10" fill="${CANVAS}">
    ${animate(
      'cx',
      needle.map((point) => point.x),
    )}
    ${animate(
      'cy',
      needle.map((point) => point.y),
    )}
    ${animate('fill', inBand)}
  </circle>
  ${angleText}

  <rect x="180" y="340" width="360" height="52" rx="26" fill="${ACCENT}"/>
  <text x="360" y="374" fill="#ffffff" font-family="system-ui, sans-serif" font-size="26" text-anchor="middle">aprieta los glúteos</text>
</svg>
`;

writeFileSync(join(root, 'docs', 'demo.svg'), svg);
console.log(`✓ docs/demo.svg (${(svg.length / 1024).toFixed(1)} kB)`);
