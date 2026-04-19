/**
 * WorldScene — the main game scene for The Grove.
 * Builds the dark forest clearing, places stations, spawns agents,
 * handles fire particles, fog, and ambient lighting.
 * 
 * Darkest Dungeon tone: dark earth, gnarled trees, torchlight, fog.
 */

import Phaser from 'phaser';
import { AGENTS } from '../agents/prompts.js';
import { AgentSprite } from '../agents/AgentSprite.js';
import { Pathfinder } from '../world/pathfinding.js';

export class WorldScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WorldScene' });
    this.agentSprites = [];
  }

  create() {
    // Initialize pathfinder (also defines the world grid)
    this.pathfinder = new Pathfinder();

    // Build the visual world
    this.buildGround();
    this.buildTrees();
    this.buildStations();
    this.buildFirePit();

    // Fog layer
    this.createFog();

    // Ambient light overlay
    this.createLighting();

    // Spawn agents
    for (const agentConfig of AGENTS) {
      const agent = new AgentSprite(this, agentConfig, this.pathfinder);
      this.agentSprites.push(agent);
    }

    // Start UI scene in parallel — UIScene handles all click detection
    // since it has input priority as the top scene.
    this.scene.launch('UIScene');
  }

  buildGround() {
    const grid = this.pathfinder.getGrid();
    const ts = this.pathfinder.getTileSize();
    const { w, h } = this.pathfinder.getGridDimensions();

    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        if (grid[row][col] === 0) {
          const tile = this.add.image(col * ts + ts / 2, row * ts + ts / 2, 'ground');
          tile.setDepth(0);
          // Slight random tint variation for organic feel
          const shade = Phaser.Math.Between(200, 255);
          tile.setTint(Phaser.Display.Color.GetColor(shade, shade - 10, shade - 20));
        }
      }
    }
  }

  buildTrees() {
    const grid = this.pathfinder.getGrid();
    const ts = this.pathfinder.getTileSize();
    const { w, h } = this.pathfinder.getGridDimensions();

    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        if (grid[row][col] === 1) {
          // Ground underneath
          const ground = this.add.image(col * ts + ts / 2, row * ts + ts / 2, 'ground');
          ground.setDepth(0);
          ground.setTint(0x100e0c);

          // Tree on top — randomize scale slightly
          const tree = this.add.image(col * ts + ts / 2, row * ts + ts / 2, 'tree');
          tree.setDepth(5);
          const scale = Phaser.Math.FloatBetween(0.9, 1.2);
          tree.setScale(scale);
          // Slight random offset for natural feel
          tree.x += Phaser.Math.Between(-3, 3);
          tree.y += Phaser.Math.Between(-3, 3);
        }
      }
    }
  }

  buildStations() {
    // Scout watchtower — upper right
    this.buildStation(1088, 140, '#d4943a', 'watchtower');
    // Blacksmith forge — lower left
    this.buildStation(200, 510, '#c44a1a', 'forge');
    // Oracle shrine — upper center
    this.buildStation(640, 110, '#6a8ccc', 'shrine');
  }

  buildStation(x, y, accentHex, type) {
    const accent = Phaser.Display.Color.HexStringToColor(accentHex).color;

    if (type === 'watchtower') {
      // Tall stone pillar
      const pillar = this.add.rectangle(x, y, 12, 28, 0x1c1916);
      pillar.setDepth(3);
      pillar.setStrokeStyle(1, 0x2a2520);
      // Torch on top
      this.addTorch(x, y - 18, accentHex);
    } else if (type === 'forge') {
      // Anvil shape
      const anvil = this.add.rectangle(x, y + 5, 20, 10, 0x1c1916);
      anvil.setDepth(3);
      anvil.setStrokeStyle(1, 0x2a2520);
      // Forge fire beneath
      const fireBed = this.add.rectangle(x - 15, y, 12, 14, 0x1a0c08);
      fireBed.setDepth(3);
      this.addFireEmitter(x - 15, y - 5, '#c44a1a', 0.6);
      // Glow on ground
      const glow = this.add.circle(x - 15, y, 30, accent, 0.06);
      glow.setDepth(1);
    } else if (type === 'shrine') {
      // Standing stones in a small arc
      for (let i = -2; i <= 2; i++) {
        const sx = x + i * 18;
        const sy = y + Math.abs(i) * 8;
        const stone = this.add.image(sx, sy, 'stone');
        stone.setDepth(3);
        stone.setScale(Phaser.Math.FloatBetween(0.7, 1.0));
      }
      // Central sigil glow
      const sigil = this.add.circle(x, y + 8, 15, accent, 0.1);
      sigil.setDepth(1);
      // Pulsing glow
      this.tweens.add({
        targets: sigil,
        alpha: { from: 0.05, to: 0.15 },
        duration: 3000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }

  addTorch(x, y, colorHex) {
    // Torch flame particle emitter
    this.addFireEmitter(x, y, colorHex, 0.4);
    // Static glow on ground
    const color = Phaser.Display.Color.HexStringToColor(colorHex).color;
    const glow = this.add.circle(x, y + 10, 40, color, 0.05);
    glow.setDepth(1);
    // Flicker
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.03, to: 0.08 },
      scaleX: { from: 0.9, to: 1.1 },
      scaleY: { from: 0.9, to: 1.1 },
      duration: Phaser.Math.Between(200, 400),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  addFireEmitter(x, y, colorHex, scale) {
    const particles = this.add.particles(x, y, 'fire_particle', {
      speed: { min: 5, max: 20 },
      angle: { min: 250, max: 290 },
      scale: { start: scale, end: 0 },
      alpha: { start: 0.8, end: 0 },
      lifespan: { min: 400, max: 800 },
      frequency: 100,
      blendMode: 'ADD',
      quantity: 1
    });
    particles.setDepth(15);
  }

  buildFirePit() {
    const cx = 640;
    const cy = 400;

    // Stone ring
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const sx = cx + Math.cos(angle) * 20;
      const sy = cy + Math.sin(angle) * 14; // slight oval
      const stone = this.add.circle(sx, sy, 4, 0x1c1916);
      stone.setDepth(3);
      stone.setStrokeStyle(1, 0x2a2520);
    }

    // Standing stones (council ring) — larger, further out
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const sx = cx + Math.cos(angle) * 55;
      const sy = cy + Math.sin(angle) * 40;
      const stone = this.add.image(sx, sy, 'stone');
      stone.setDepth(3);
      stone.setScale(Phaser.Math.FloatBetween(0.6, 0.9));
    }

    // Central fire
    this.addFireEmitter(cx, cy - 4, '#d4943a', 0.8);

    // Fire glow on ground
    const fireGlow = this.add.circle(cx, cy, 50, 0xd4943a, 0.08);
    fireGlow.setDepth(1);
    this.tweens.add({
      targets: fireGlow,
      alpha: { from: 0.05, to: 0.12 },
      scaleX: { from: 0.95, to: 1.05 },
      scaleY: { from: 0.95, to: 1.05 },
      duration: 300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Warm glow on surrounding ground — larger radius
    const ambientGlow = this.add.circle(cx, cy, 90, 0xd4943a, 0.03);
    ambientGlow.setDepth(1);
  }

  createFog() {
    // Slow-drifting fog particles across the scene
    const fogEmitter = this.add.particles(640, 360, 'fog_particle', {
      x: { min: -100, max: 1380 },
      y: { min: -50, max: 770 },
      speed: { min: 2, max: 8 },
      angle: { min: 170, max: 190 },
      scale: { min: 1.5, max: 3 },
      alpha: { start: 0.15, end: 0 },
      lifespan: { min: 8000, max: 15000 },
      frequency: 2000,
      blendMode: 'NORMAL',
      quantity: 1
    });
    fogEmitter.setDepth(25);
  }

  createLighting() {
    // Dark vignette overlay — darker at edges, lighter at center fire
    const vignette = this.add.graphics();
    vignette.setDepth(30);
    vignette.setAlpha(0.4);

    // Draw a full-screen dark overlay with a radial gradient cut-out at the fire pit
    // Using a series of concentric rectangles with decreasing alpha
    const cx = 640, cy = 400;
    for (let i = 10; i >= 0; i--) {
      const alpha = (i / 10) * 0.5;
      const radius = 200 + (10 - i) * 50;
      vignette.fillStyle(0x050403, alpha);
      // Top
      vignette.fillRect(0, 0, 1280, Math.max(0, cy - radius));
      // Bottom
      vignette.fillRect(0, Math.min(720, cy + radius), 1280, 720 - Math.min(720, cy + radius));
      // Left
      vignette.fillRect(0, Math.max(0, cy - radius), Math.max(0, cx - radius), radius * 2);
      // Right
      vignette.fillRect(Math.min(1280, cx + radius), Math.max(0, cy - radius), 1280 - Math.min(1280, cx + radius), radius * 2);
    }

    // Title text — subtle, top center
    const title = this.add.text(640, 16, 'THE GROVE', {
      fontFamily: '"Courier New", monospace',
      fontSize: '18px',
      color: '#7a756e',
      letterSpacing: 10
    });
    title.setOrigin(0.5, 0);
    title.setDepth(35);
  }

  update(time, delta) {
    // Update all agents
    for (const agent of this.agentSprites) {
      agent.update(time, delta);
    }
  }
}
