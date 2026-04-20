/**
 * UIScene — handles click detection on agent sprites.
 * When an agent is clicked, selects them in the DOM chat bar.
 * Speech bubbles for agent-to-agent conversation (future).
 */

import Phaser from 'phaser';

export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
  }

  create() {
    // Click handler — detect clicks on agent sprites
    this.input.on('pointerdown', (pointer) => {
      const worldScene = this.scene.get('WorldScene');
      if (!worldScene || !worldScene.agentSprites) return;

      for (const agent of worldScene.agentSprites) {
        const sprite = agent.sprite;
        const dx = Math.abs(pointer.x - sprite.x);
        const dy = Math.abs(pointer.y - (sprite.y - 48)); // offset for bottom origin
        if (dx < 40 && dy < 56) {
          // Select this agent in the chat bar
          if (window.__chatBar) {
            window.__chatBar.selectAgent(agent.config.id);
          }
          return;
        }
      }
    });
  }
}
