/**
 * The Grove — main entry point
 * Phaser 3 office world with DOM chat bar below.
 */

import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { WorldScene } from './scenes/WorldScene.js';
import { UIScene } from './scenes/UIScene.js';
import { ChatBar } from './ui/ChatBar.js';

const config = {
  type: Phaser.WEBGL,
  parent: 'game-container',
  width: 1920,
  height: 1104,
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
    windowEvents: true
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_HORIZONTAL
  }
};

const game = new Phaser.Game(config);

// Initialize DOM chat bar after game starts
game.events.once('ready', () => {
  const chatBar = new ChatBar();

  // Wire chat to API
  chatBar.onSendMessage = async (agentId, message) => {
    const history = chatBar.chatHistory.getMessages(agentId).slice(0, -1);
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: agentId, message, history })
    });
    if (!response.ok) throw new Error(`API ${response.status}`);
    const data = await response.json();
    return data.reply || 'No response.';
  };

  // Expose chatBar to Phaser scenes
  window.__chatBar = chatBar;
});
