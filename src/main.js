/**
 * The Grove — main entry point
 * Phaser 3 game: dark pixel-art world where AI agents wander as silhouette characters.
 * Darkest Dungeon visual reference. Phase 1: autonomous wandering, no AI.
 */

import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { WorldScene } from './scenes/WorldScene.js';
import { UIScene } from './scenes/UIScene.js';

const config = {
  type: Phaser.WEBGL,
  parent: 'game-container',
  width: 1280,
  height: 720,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#0a0a0a',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: [BootScene, WorldScene, UIScene],
  input: {
    // Allow input to pass through to all active scenes (WorldScene + UIScene)
    windowEvents: true
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

const game = new Phaser.Game(config);
