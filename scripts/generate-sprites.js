/**
 * Sprite Generator — creates silhouette spritesheets for The Grove agents.
 * Run with: node scripts/generate-sprites.js
 * 
 * Generates 48x48 silhouette characters with 4-directional walk cycles.
 * Each agent has a distinct silhouette shape and accent color from their light source.
 * 
 * Output: assets/agents/scout.png, blacksmith.png, oracle.png
 * Spritesheet layout: 4 columns (walk frames) x 4 rows (down, left, right, up)
 */

import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, '..', 'assets', 'agents');

const FRAME_W = 48;
const FRAME_H = 48;
const COLS = 4; // walk frames
const ROWS = 5; // down, left, right, up, idle
const SHEET_W = FRAME_W * COLS;
const SHEET_H = FRAME_H * ROWS;

// Agent definitions
const agents = {
  scout: {
    // Mina — hooded, lean, carries a lantern
    bodyColor: '#0d0d0d',
    edgeColor: '#2a2218',
    accentColor: '#d4943a', // amber lantern glow
    draw: drawScout
  },
  blacksmith: {
    // Productivity — stocky, apron, hammer
    bodyColor: '#0d0d0d',
    edgeColor: '#2a1a14',
    accentColor: '#c44a1a', // forge coal orange-red
    draw: drawBlacksmith
  },
  oracle: {
    // Futures — tall, robed, staff with glowing orb
    bodyColor: '#0d0d0d',
    edgeColor: '#141a2a',
    accentColor: '#6a8ccc', // sigil blue-white
    draw: drawOracle
  }
};

// Direction offsets for subtle body lean during walk
const dirOffsets = {
  down:  { headX: 0, headY: 0, bodyLean: 0 },
  left:  { headX: -1, headY: 0, bodyLean: -1 },
  right: { headX: 1, headY: 0, bodyLean: 1 },
  up:    { headX: 0, headY: -1, bodyLean: 0 }
};

const directions = ['down', 'left', 'right', 'up'];

function drawScout(ctx, dir, frame, colors) {
  const cx = FRAME_W / 2;
  const lean = dirOffsets[dir].bodyLean;
  const walkBob = Math.sin(frame * Math.PI / 2) * 1.5;
  const legSwing = Math.sin(frame * Math.PI / 2) * 3;

  ctx.fillStyle = colors.bodyColor;
  ctx.strokeStyle = colors.edgeColor;
  ctx.lineWidth = 1;

  // Hood/head — pointed hood shape
  ctx.beginPath();
  if (dir === 'up') {
    // From behind, hood is rounded
    ctx.ellipse(cx + lean, 14 + walkBob, 7, 8, 0, 0, Math.PI * 2);
  } else {
    // Hood with point
    ctx.moveTo(cx - 6 + lean, 18 + walkBob);
    ctx.lineTo(cx + lean, 6 + walkBob);
    ctx.lineTo(cx + 6 + lean, 18 + walkBob);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();

  // Cloak body — wider at bottom for flow
  ctx.beginPath();
  ctx.moveTo(cx - 6 + lean, 18 + walkBob);
  ctx.lineTo(cx - 9 + lean, 36 + walkBob);
  ctx.lineTo(cx + 9 + lean, 36 + walkBob);
  ctx.lineTo(cx + 6 + lean, 18 + walkBob);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Legs
  ctx.beginPath();
  ctx.moveTo(cx - 3 + lean, 36 + walkBob);
  ctx.lineTo(cx - 3 + legSwing + lean, 44 + walkBob);
  ctx.moveTo(cx + 3 + lean, 36 + walkBob);
  ctx.lineTo(cx + 3 - legSwing + lean, 44 + walkBob);
  ctx.strokeStyle = colors.bodyColor;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Lantern — small glowing point held at side
  ctx.strokeStyle = colors.edgeColor;
  ctx.lineWidth = 1;
  if (dir !== 'up') {
    const lanternX = dir === 'left' ? cx - 10 : cx + 10;
    const lanternY = 28 + walkBob + Math.sin(frame * Math.PI / 2) * 0.5;

    // Lantern handle
    ctx.beginPath();
    ctx.moveTo(dir === 'left' ? cx - 6 + lean : cx + 6 + lean, 24 + walkBob);
    ctx.lineTo(lanternX, lanternY);
    ctx.strokeStyle = colors.edgeColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Lantern glow
    ctx.fillStyle = colors.accentColor;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(lanternX, lanternY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Glow halo
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.arc(lanternX, lanternY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawBlacksmith(ctx, dir, frame, colors) {
  const cx = FRAME_W / 2;
  const lean = dirOffsets[dir].bodyLean;
  const walkBob = Math.sin(frame * Math.PI / 2) * 1;
  const legSwing = Math.sin(frame * Math.PI / 2) * 2.5;

  ctx.fillStyle = colors.bodyColor;
  ctx.strokeStyle = colors.edgeColor;
  ctx.lineWidth = 1;

  // Head — round, larger, no hood
  ctx.beginPath();
  ctx.arc(cx + lean, 13 + walkBob, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Broad shoulders / stocky torso
  ctx.beginPath();
  ctx.moveTo(cx - 10 + lean, 20 + walkBob);
  ctx.lineTo(cx - 11 + lean, 33 + walkBob);
  ctx.lineTo(cx + 11 + lean, 33 + walkBob);
  ctx.lineTo(cx + 10 + lean, 20 + walkBob);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Apron detail — slightly lighter rectangle
  ctx.fillStyle = colors.edgeColor;
  ctx.fillRect(cx - 5 + lean, 22 + walkBob, 10, 11);

  // Legs — thick
  ctx.beginPath();
  ctx.moveTo(cx - 4 + lean, 33 + walkBob);
  ctx.lineTo(cx - 4 + legSwing + lean, 44 + walkBob);
  ctx.moveTo(cx + 4 + lean, 33 + walkBob);
  ctx.lineTo(cx + 4 - legSwing + lean, 44 + walkBob);
  ctx.strokeStyle = colors.bodyColor;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Hammer — held on one side
  ctx.strokeStyle = colors.edgeColor;
  ctx.lineWidth = 1;
  if (dir !== 'up') {
    const hammerSide = dir === 'left' ? -1 : 1;
    const hammerX = cx + 13 * hammerSide + lean;
    const hammerBob = Math.sin(frame * Math.PI / 2) * 2;

    // Handle
    ctx.beginPath();
    ctx.moveTo(cx + 8 * hammerSide + lean, 22 + walkBob);
    ctx.lineTo(hammerX, 16 + walkBob + hammerBob);
    ctx.strokeStyle = colors.edgeColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Hammer head
    ctx.fillStyle = colors.edgeColor;
    ctx.fillRect(hammerX - 3, 12 + walkBob + hammerBob, 6, 5);

    // Forge glow on hammer
    ctx.fillStyle = colors.accentColor;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(hammerX, 14 + walkBob + hammerBob, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawOracle(ctx, dir, frame, colors) {
  const cx = FRAME_W / 2;
  const lean = dirOffsets[dir].bodyLean;
  const walkBob = Math.sin(frame * Math.PI / 2) * 0.8;
  const legSwing = Math.sin(frame * Math.PI / 2) * 2;

  ctx.fillStyle = colors.bodyColor;
  ctx.strokeStyle = colors.edgeColor;
  ctx.lineWidth = 1;

  // Head — slightly elongated, mysterious
  ctx.beginPath();
  ctx.ellipse(cx + lean, 12 + walkBob, 6, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Long robes — tall, flowing, wider at bottom
  ctx.beginPath();
  ctx.moveTo(cx - 7 + lean, 19 + walkBob);
  ctx.lineTo(cx - 12 + lean, 42 + walkBob);
  ctx.lineTo(cx + 12 + lean, 42 + walkBob);
  ctx.lineTo(cx + 7 + lean, 19 + walkBob);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Robe hem detail
  ctx.beginPath();
  ctx.moveTo(cx - 12 + lean, 42 + walkBob);
  for (let i = 0; i < 5; i++) {
    const x = cx - 12 + lean + (i * 6);
    ctx.lineTo(x + 3, 44 + walkBob);
    ctx.lineTo(x + 6, 42 + walkBob);
  }
  ctx.strokeStyle = colors.edgeColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Staff — tall, held upright
  const staffSide = dir === 'left' ? -1 : 1;
  const staffX = cx + 10 * staffSide + lean;

  // Staff line
  ctx.beginPath();
  ctx.moveTo(staffX, 4 + walkBob);
  ctx.lineTo(staffX, 40 + walkBob);
  ctx.strokeStyle = colors.edgeColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Orb at top of staff
  ctx.fillStyle = colors.accentColor;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(staffX, 4 + walkBob, 4, 0, Math.PI * 2);
  ctx.fill();

  // Orb glow
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.arc(staffX, 4 + walkBob, 10, 0, Math.PI * 2);
  ctx.fill();

  // Inner orb glow
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(staffX, 4 + walkBob, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function generateSpritesheet(name, agent) {
  const canvas = createCanvas(SHEET_W, SHEET_H);
  const ctx = canvas.getContext('2d');

  // Transparent background
  ctx.clearRect(0, 0, SHEET_W, SHEET_H);

  // Draw each direction row
  directions.forEach((dir, row) => {
    for (let frame = 0; frame < COLS; frame++) {
      ctx.save();
      ctx.translate(frame * FRAME_W, row * FRAME_H);
      // Clip to frame bounds
      ctx.beginPath();
      ctx.rect(0, 0, FRAME_W, FRAME_H);
      ctx.clip();
      agent.draw(ctx, dir, frame, agent);
      ctx.restore();
    }
  });

  // Row 5: idle frames (facing down, subtle breathing motion)
  for (let frame = 0; frame < COLS; frame++) {
    ctx.save();
    ctx.translate(frame * FRAME_W, 4 * FRAME_H);
    ctx.beginPath();
    ctx.rect(0, 0, FRAME_W, FRAME_H);
    ctx.clip();
    // Idle uses frame 0 with slight vertical oscillation
    agent.draw(ctx, 'down', frame * 0.3, agent);
    ctx.restore();
  }

  // Write to file
  const buffer = canvas.toBuffer('image/png');
  const outPath = path.join(ASSETS_DIR, `${name}.png`);
  fs.writeFileSync(outPath, buffer);
  console.log(`  ✓ ${outPath}`);
}

// Ensure output dir exists
fs.mkdirSync(ASSETS_DIR, { recursive: true });

console.log('Generating silhouette spritesheets...');
for (const [name, agent] of Object.entries(agents)) {
  generateSpritesheet(name, agent);
}
console.log('Done.');
