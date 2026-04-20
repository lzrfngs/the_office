/**
 * BootScene — preloads LimeZu assets: office tileset and character spritesheets.
 * Character sheets are 2688x1920 (56 cols × 40 rows of 48x48 frames).
 * Only idle (row 3) and walk (row 5) rows are used for game animations.
 */

import Phaser from 'phaser';
import { AGENTS } from '../agents/prompts.js';

// LimeZu spritesheet layout constants
const FRAME_W = 48;
const FRAME_H = 96;  // Characters are 48x96 (span 2 tile rows)
const SHEET_COLS = 56;
const SHEET_ROWS = 20; // 40 tile-rows / 2 = 20 character-rows

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Load character spritesheets — full LimeZu composite sheets
    for (const agent of AGENTS) {
      this.load.spritesheet(agent.spriteKey, `assets/agents/${agent.spriteKey}.png`, {
        frameWidth: FRAME_W,
        frameHeight: FRAME_H,
      });
    }

    // Office tilemap (Tiled JSON) and tileset images
    this.load.tilemapTiledJSON('office', 'assets/office.json');
    this.load.image('Room_Builder_Office_48x48', 'assets/tiles/Room_Builder_Office_48x48.png');
    this.load.image('Modern_Office_Shadowless_48x48', 'assets/tiles/Modern_Office_Shadowless_48x48.png');
  }

  create() {
    // Generate fallback silhouettes for any agents whose sheets didn't load
    for (const agent of AGENTS) {
      if (!this.textures.exists(agent.spriteKey)) {
        this.generateFallbackSprite(agent);
      }
    }

    // Generate simple textures for the office environment
    this.generateWorldTextures();

    // Create animations for each agent from their LimeZu spritesheet
    this.createCharacterAnimations();

    this.scene.start('WorldScene');
  }

  createCharacterAnimations() {
    for (const agent of AGENTS) {
      const key = agent.spriteKey;

      // LimeZu layout with 48x96 frames (2 tile-rows per character-row):
      // Row 1 (char-row 1) = Idle: 6 frames x 4 dirs
      // Row 2 (char-row 2) = Walk: 6 frames x 4 dirs
      // Frame index = charRow * SHEET_COLS + col
      // Actual direction order in spritesheet: right, up, left, down

      const idleRow = 1;   // char-row 1 = tile-rows 2-3 (idle)
      const walkRow = 2;   // char-row 2 = tile-rows 4-5 (walk)
      const framesPerDir = 6;

      // Sprite column order → direction label mapping
      const dirs = ['right', 'up', 'left', 'down'];

      dirs.forEach((dir, dirIndex) => {
        const startCol = dirIndex * framesPerDir;

        // Idle animation
        this.anims.create({
          key: `${key}_idle_${dir}`,
          frames: this.anims.generateFrameNumbers(key, {
            start: idleRow * SHEET_COLS + startCol,
            end: idleRow * SHEET_COLS + startCol + framesPerDir - 1
          }),
          frameRate: 5,
          repeat: -1
        });

        // Walk animation
        this.anims.create({
          key: `${key}_walk_${dir}`,
          frames: this.anims.generateFrameNumbers(key, {
            start: walkRow * SHEET_COLS + startCol,
            end: walkRow * SHEET_COLS + startCol + framesPerDir - 1
          }),
          frameRate: 8,
          repeat: -1
        });
      });
    }
  }

  generateFallbackSprite(agent) {
    // Simple colored rectangle as placeholder
    const canvas = this.textures.createCanvas(agent.spriteKey, FRAME_W * SHEET_COLS, FRAME_H * SHEET_ROWS);
    const ctx = canvas.getContext();

    const color = agent.accentColor || '#666666';

    // Draw a simple figure at idle and walk positions
    const drawAt = (col, row) => {
      const x = col * FRAME_W + FRAME_W / 2;
      const y = row * FRAME_H + FRAME_H / 2;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y - 16, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - 8, y - 4, 16, 28);
    };

    // Fill idle row (1) and walk row (2) with 24 frames each
    for (let i = 0; i < 24; i++) {
      drawAt(i, 1);
      drawAt(i, 2);
    }

    canvas.refresh();
  }

  generateWorldTextures() {
    // Office floor tile
    const floorCanvas = this.textures.createCanvas('floor', 48, 48);
    const fCtx = floorCanvas.getContext();
    fCtx.fillStyle = '#e8e0d4';
    fCtx.fillRect(0, 0, 48, 48);
    // Subtle tile grid
    fCtx.strokeStyle = '#d8d0c4';
    fCtx.lineWidth = 0.5;
    fCtx.strokeRect(0, 0, 48, 48);
    // Slight noise for warmth
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * 48;
      const y = Math.random() * 48;
      fCtx.fillStyle = `rgba(200, 190, 175, ${Math.random() * 0.15})`;
      fCtx.fillRect(x, y, 1, 1);
    }
    floorCanvas.refresh();

    // Wall tile
    const wallCanvas = this.textures.createCanvas('wall', 48, 48);
    const wCtx = wallCanvas.getContext();
    wCtx.fillStyle = '#f0ece6';
    wCtx.fillRect(0, 0, 48, 48);
    wCtx.strokeStyle = '#d8d4ce';
    wCtx.lineWidth = 0.5;
    wCtx.strokeRect(0, 0, 48, 48);
    wallCanvas.refresh();

    // Desk surface
    const deskCanvas = this.textures.createCanvas('desk', 96, 48);
    const dCtx = deskCanvas.getContext();
    dCtx.fillStyle = '#8b7355';
    dCtx.fillRect(0, 0, 96, 48);
    dCtx.strokeStyle = '#6b5335';
    dCtx.lineWidth = 1;
    dCtx.strokeRect(0, 0, 96, 48);
    // Monitor shape
    dCtx.fillStyle = '#2a2a2e';
    dCtx.fillRect(8, 4, 28, 20);
    dCtx.fillStyle = '#1a3a4a';
    dCtx.fillRect(10, 6, 24, 16);
    // Keyboard
    dCtx.fillStyle = '#3a3a3e';
    dCtx.fillRect(8, 28, 24, 8);
    deskCanvas.refresh();

    // Conference table
    const tableCanvas = this.textures.createCanvas('conf_table', 192, 96);
    const tCtx = tableCanvas.getContext();
    tCtx.fillStyle = '#6b5335';
    tCtx.beginPath();
    tCtx.roundRect(4, 4, 184, 88, 8);
    tCtx.fill();
    tCtx.strokeStyle = '#5a4228';
    tCtx.lineWidth = 1.5;
    tCtx.stroke();
    tableCanvas.refresh();

    // Monitor glow particle
    const glowCanvas = this.textures.createCanvas('monitor_glow', 8, 8);
    const gCtx = glowCanvas.getContext();
    const grad = gCtx.createRadialGradient(4, 4, 0, 4, 4, 4);
    grad.addColorStop(0, '#4a8ab8');
    grad.addColorStop(1, 'transparent');
    gCtx.fillStyle = grad;
    gCtx.fillRect(0, 0, 8, 8);
    glowCanvas.refresh();
  }
}
