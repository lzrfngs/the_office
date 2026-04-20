/**
 * SpeechBubble — floating text bubble above an agent.
 * Shows agent dialogue in-world, fades out after a duration.
 * Styled to match the dark atmosphere with agent accent color.
 */

import Phaser from 'phaser';

const BUBBLE_MAX_WIDTH = 300;
const BUBBLE_PADDING = 12;
const FADE_DURATION = 500;

export class SpeechBubble {
  constructor(scene, x, y, text, accentColor, duration = 5000) {
    this.scene = scene;
    this.duration = duration;

    // Measure text to size bubble
    const textObj = scene.add.text(0, 0, text, {
      fontFamily: '"Courier New", monospace',
      fontSize: '22px',
      color: '#1a1a1a',
      wordWrap: { width: BUBBLE_MAX_WIDTH - BUBBLE_PADDING * 2 },
      lineSpacing: 5
    });
    textObj.setOrigin(0, 0);

    const textWidth = Math.min(textObj.width + BUBBLE_PADDING * 2, BUBBLE_MAX_WIDTH);
    const textHeight = textObj.height + BUBBLE_PADDING * 2;

    // Background — white bubble
    const bg = scene.add.graphics();
    bg.fillStyle(0xffffff, 0.95);
    bg.fillRoundedRect(0, 0, textWidth, textHeight, 4);
    // Accent border on left edge
    bg.fillStyle(Phaser.Display.Color.HexStringToColor(accentColor).color, 0.8);
    bg.fillRect(0, 2, 3, textHeight - 4);

    // Tail triangle pointing down
    bg.fillStyle(0xffffff, 0.95);
    bg.fillTriangle(
      textWidth / 2 - 5, textHeight,
      textWidth / 2 + 5, textHeight,
      textWidth / 2, textHeight + 8
    );

    // Position text inside bubble
    textObj.setPosition(BUBBLE_PADDING, BUBBLE_PADDING);

    // Container
    this.container = scene.add.container(
      x - textWidth / 2,
      y - textHeight - 12
    );
    this.container.setDepth(40);
    this.container.add(bg);
    this.container.add(textObj);
    this.container.setAlpha(0);

    // Fade in
    scene.tweens.add({
      targets: this.container,
      alpha: 1,
      y: this.container.y - 4,
      duration: 200,
      ease: 'Power2'
    });

    // Auto-destroy after duration
    scene.time.delayedCall(duration, () => this.destroy());
  }

  updatePosition(x, y) {
    if (this.container && this.container.active) {
      this.container.x = x - this.container.getBounds().width / 2;
      this.container.y = y - this.container.getBounds().height - 12;
    }
  }

  destroy() {
    if (!this.container || !this.container.active) return;
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      y: this.container.y - 6,
      duration: FADE_DURATION,
      ease: 'Power2',
      onComplete: () => {
        if (this.container) this.container.destroy();
      }
    });
  }
}
