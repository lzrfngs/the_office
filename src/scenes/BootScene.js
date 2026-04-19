/**
 * BootScene — preloads assets and generates placeholder textures.
 * Silhouette sprites are generated programmatically if PNGs aren't available.
 */

import Phaser from 'phaser';
import { AGENTS } from '../agents/prompts.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Try loading spritesheet PNGs — if they don't exist, we'll generate them in create()
    for (const agent of AGENTS) {
      this.load.spritesheet(agent.spriteKey, `assets/agents/${agent.spriteKey}.png`, {
        frameWidth: 48,
        frameHeight: 48
      });
    }

    // Tileset texture will be generated programmatically
  }

  create() {
    // Generate any missing textures
    for (const agent of AGENTS) {
      if (!this.textures.exists(agent.spriteKey)) {
        this.generateSilhouette(agent);
      }
    }

    // Generate world textures
    this.generateWorldTextures();

    this.scene.start('WorldScene');
  }

  /**
   * Fallback: generate a simple silhouette sprite programmatically
   * when PNG spritesheets aren't available.
   */
  generateSilhouette(agent) {
    const fw = 48, fh = 48;
    const cols = 4, rows = 5;
    const canvas = this.textures.createCanvas(agent.spriteKey, fw * cols, fh * rows);
    const ctx = canvas.getContext();

    const drawFigure = (x, y, frame, dir) => {
      const cx = x + fw / 2;
      const bob = Math.sin(frame * Math.PI / 2) * 1.5;
      const legSwing = Math.sin(frame * Math.PI / 2) * 3;

      ctx.fillStyle = '#0d0d0d';
      ctx.strokeStyle = agent.edgeColor || '#1a1a1a';
      ctx.lineWidth = 1;

      // Head
      const headW = agent.id === 'blacksmith' ? 7 : 6;
      const headH = agent.id === 'oracle' ? 7 : 6;
      ctx.beginPath();
      ctx.ellipse(cx, y + 13 + bob, headW, headH, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Hood for scout
      if (agent.id === 'scout' && dir !== 'up') {
        ctx.beginPath();
        ctx.moveTo(cx - 6, y + 18 + bob);
        ctx.lineTo(cx, y + 6 + bob);
        ctx.lineTo(cx + 6, y + 18 + bob);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Body
      const bw = agent.id === 'blacksmith' ? 11 : agent.id === 'oracle' ? 7 : 8;
      const bwBottom = agent.id === 'oracle' ? 12 : bw + 1;
      const bodyBottom = agent.id === 'oracle' ? 42 : 36;
      ctx.beginPath();
      ctx.moveTo(cx - bw, y + 19 + bob);
      ctx.lineTo(cx - bwBottom, y + bodyBottom + bob);
      ctx.lineTo(cx + bwBottom, y + bodyBottom + bob);
      ctx.lineTo(cx + bw, y + 19 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Legs (skip for oracle — robes cover them)
      if (agent.id !== 'oracle') {
        ctx.beginPath();
        ctx.moveTo(cx - 3, y + bodyBottom + bob);
        ctx.lineTo(cx - 3 + legSwing, y + 44 + bob);
        ctx.moveTo(cx + 3, y + bodyBottom + bob);
        ctx.lineTo(cx + 3 - legSwing, y + 44 + bob);
        ctx.lineWidth = agent.id === 'blacksmith' ? 4 : 3;
        ctx.strokeStyle = '#0d0d0d';
        ctx.stroke();
      }

      // Accent element
      ctx.fillStyle = agent.accentColor;
      ctx.globalAlpha = 0.85;
      if (agent.id === 'scout' && dir !== 'up') {
        // Lantern
        ctx.beginPath();
        ctx.arc(cx + 10, y + 28 + bob, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.arc(cx + 10, y + 28 + bob, 7, 0, Math.PI * 2);
        ctx.fill();
      } else if (agent.id === 'oracle') {
        // Staff orb
        const sx = cx + 10;
        ctx.beginPath();
        ctx.arc(sx, y + 4 + bob, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.15;
        ctx.beginPath();
        ctx.arc(sx, y + 4 + bob, 10, 0, Math.PI * 2);
        ctx.fill();
      } else if (agent.id === 'blacksmith') {
        // Hammer glow
        ctx.beginPath();
        ctx.arc(cx + 13, y + 14 + bob, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const dirs = ['down', 'left', 'right', 'up'];
    dirs.forEach((dir, row) => {
      for (let frame = 0; frame < cols; frame++) {
        drawFigure(frame * fw, row * fh, frame, dir);
      }
    });
    // Idle row
    for (let frame = 0; frame < cols; frame++) {
      drawFigure(frame * fw, 4 * fh, frame * 0.3, 'down');
    }

    canvas.refresh();

    // Add spritesheet frames manually
    const texture = this.textures.get(agent.spriteKey);
    // Remove auto-generated frames
    texture.add('__BASE', 0, 0, 0, fw * cols, fh * rows);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const frameIndex = row * cols + col;
        texture.add(frameIndex, 0, col * fw, row * fh, fw, fh);
      }
    }
  }

  generateWorldTextures() {
    // Ground tile — dark earth with subtle variation
    const groundCanvas = this.textures.createCanvas('ground', 32, 32);
    const gCtx = groundCanvas.getContext();
    gCtx.fillStyle = '#1a1612';
    gCtx.fillRect(0, 0, 32, 32);
    // Noise texture
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * 32;
      const y = Math.random() * 32;
      const brightness = Math.random() * 15 + 15;
      gCtx.fillStyle = `rgb(${brightness}, ${brightness - 3}, ${brightness - 5})`;
      gCtx.fillRect(x, y, 1, 1);
    }
    groundCanvas.refresh();

    // Tree tile — dark trunk silhouette
    const treeCanvas = this.textures.createCanvas('tree', 32, 32);
    const tCtx = treeCanvas.getContext();
    tCtx.clearRect(0, 0, 32, 32);
    tCtx.fillStyle = '#0a0806';
    // Trunk
    tCtx.fillRect(13, 12, 6, 20);
    // Canopy
    tCtx.beginPath();
    tCtx.arc(16, 10, 10, 0, Math.PI * 2);
    tCtx.fill();
    // Canopy edge highlight
    tCtx.strokeStyle = '#14110e';
    tCtx.lineWidth = 1;
    tCtx.stroke();
    treeCanvas.refresh();

    // Stone tile — ruins/standing stones
    const stoneCanvas = this.textures.createCanvas('stone', 32, 32);
    const sCtx = stoneCanvas.getContext();
    sCtx.clearRect(0, 0, 32, 32);
    sCtx.fillStyle = '#1c1916';
    sCtx.beginPath();
    sCtx.moveTo(8, 30);
    sCtx.lineTo(6, 6);
    sCtx.lineTo(12, 2);
    sCtx.lineTo(20, 2);
    sCtx.lineTo(26, 6);
    sCtx.lineTo(24, 30);
    sCtx.closePath();
    sCtx.fill();
    sCtx.strokeStyle = '#2a2520';
    sCtx.lineWidth = 1;
    sCtx.stroke();
    stoneCanvas.refresh();

    // Fire particle texture
    const fireCanvas = this.textures.createCanvas('fire_particle', 8, 8);
    const fCtx = fireCanvas.getContext();
    fCtx.clearRect(0, 0, 8, 8);
    const fireGrad = fCtx.createRadialGradient(4, 4, 0, 4, 4, 4);
    fireGrad.addColorStop(0, '#d4943a');
    fireGrad.addColorStop(0.6, '#c44a1a');
    fireGrad.addColorStop(1, 'transparent');
    fCtx.fillStyle = fireGrad;
    fCtx.fillRect(0, 0, 8, 8);
    fireCanvas.refresh();

    // Fog particle
    const fogCanvas = this.textures.createCanvas('fog_particle', 64, 64);
    const fogCtx = fogCanvas.getContext();
    fogCtx.clearRect(0, 0, 64, 64);
    const fogGrad = fogCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    fogGrad.addColorStop(0, 'rgba(20, 18, 15, 0.3)');
    fogGrad.addColorStop(1, 'transparent');
    fogCtx.fillStyle = fogGrad;
    fogCtx.fillRect(0, 0, 64, 64);
    fogCanvas.refresh();
  }
}
