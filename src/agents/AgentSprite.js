/**
 * AgentSprite — Phaser sprite wrapper with FSM, pathfinding, and animation.
 * Each agent is a sprite with walk animations, a name label, and state-driven behavior.
 */

import Phaser from 'phaser';
import { AgentFSM } from './AgentFSM.js';

const WALK_SPEED = 55; // pixels per second — deliberate, weighty movement

export class AgentSprite {
  constructor(scene, config, pathfinder) {
    this.scene = scene;
    this.config = config;
    this.pathfinder = pathfinder;

    // Create sprite at station position
    this.sprite = scene.add.sprite(config.station.x, config.station.y, config.spriteKey, 0);
    this.sprite.setOrigin(0.5, 0.5);
    this.sprite.setDepth(10);
    // Larger hit area — sprite is 48x48 but we want a generous click target
    this.sprite.setInteractive({
      useHandCursor: true,
      hitArea: new Phaser.Geom.Rectangle(-16, -20, 80, 88),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains
    });

    // Store reference back to agent data
    this.sprite.setData('agent', this);

    // Walk path state
    this.path = [];
    this.pathIndex = 0;
    this.isWalking = false;
    this.onPathComplete = null;
    this.currentDir = 'down';

    // Name label
    this.nameLabel = scene.add.text(config.station.x, config.station.y - 32, config.name, {
      fontFamily: '"Courier New", monospace',
      fontSize: '14px',
      color: config.accentColor,
      stroke: '#0a0a0a',
      strokeThickness: 3,
      align: 'center'
    });
    this.nameLabel.setOrigin(0.5, 1);
    this.nameLabel.setDepth(20);
    this.nameLabel.setAlpha(1);

    // Status text (shows current state)
    this.statusText = scene.add.text(config.station.x, config.station.y + 28, '', {
      fontFamily: '"Courier New", monospace',
      fontSize: '12px',
      color: '#8a857e',
      align: 'center'
    });
    this.statusText.setOrigin(0.5, 0);
    this.statusText.setDepth(20);

    // Create animations
    this.createAnimations();

    // Initialize FSM
    this.fsm = new AgentFSM(this);

    // Start with a slight delay so agents don't all move at once
    scene.time.delayedCall(Phaser.Math.Between(500, 3000), () => {
      this.fsm.transition('idle');
    });
  }

  createAnimations() {
    const key = this.config.spriteKey;

    // 4 columns per row, 5 rows: down(0-3), left(4-7), right(8-11), up(12-15), idle(16-19)
    const dirs = ['down', 'left', 'right', 'up'];
    dirs.forEach((dir, row) => {
      this.scene.anims.create({
        key: `${key}_walk_${dir}`,
        frames: this.scene.anims.generateFrameNumbers(key, {
          start: row * 4,
          end: row * 4 + 3
        }),
        frameRate: 6,
        repeat: -1
      });
    });

    // Idle animation — row 5 (frames 16-19), slow
    this.scene.anims.create({
      key: `${key}_idle`,
      frames: this.scene.anims.generateFrameNumbers(key, {
        start: 16,
        end: 19
      }),
      frameRate: 3,
      repeat: -1
    });
  }

  playAnim(type) {
    const key = this.config.spriteKey;
    if (type === 'idle') {
      this.sprite.play(`${key}_idle`, true);
    } else if (type === 'walk') {
      this.sprite.play(`${key}_walk_${this.currentDir}`, true);
    }
  }

  faceStation() {
    // Determine direction from current pos to station
    const dx = this.config.station.x - this.sprite.x;
    const dy = this.config.station.y - this.sprite.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      this.currentDir = dx > 0 ? 'right' : 'left';
    } else {
      this.currentDir = dy > 0 ? 'down' : 'up';
    }
  }

  async walkTo(x, y, onComplete) {
    const path = await this.pathfinder.findPath(
      this.sprite.x, this.sprite.y, x, y
    );

    if (path.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    this.path = path;
    this.pathIndex = 0;
    this.isWalking = true;
    this.onPathComplete = onComplete;
    this.playAnim('walk');
  }

  stop() {
    this.isWalking = false;
    this.path = [];
    this.pathIndex = 0;
  }

  update(time, delta) {
    // Update FSM
    this.fsm.update(delta);

    // Follow path
    if (this.isWalking && this.path.length > 0) {
      const target = this.path[this.pathIndex];
      const dx = target.x - this.sprite.x;
      const dy = target.y - this.sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 3) {
        // Reached waypoint, move to next
        this.pathIndex++;
        if (this.pathIndex >= this.path.length) {
          // Path complete
          this.isWalking = false;
          this.playAnim('idle');
          if (this.onPathComplete) {
            this.onPathComplete();
            this.onPathComplete = null;
          }
          return;
        }
      }

      // Move toward current waypoint
      const moveX = (dx / dist) * WALK_SPEED * (delta / 1000);
      const moveY = (dy / dist) * WALK_SPEED * (delta / 1000);
      this.sprite.x += moveX;
      this.sprite.y += moveY;

      // Update facing direction
      if (Math.abs(dx) > Math.abs(dy)) {
        const newDir = dx > 0 ? 'right' : 'left';
        if (newDir !== this.currentDir) {
          this.currentDir = newDir;
          this.playAnim('walk');
        }
      } else {
        const newDir = dy > 0 ? 'down' : 'up';
        if (newDir !== this.currentDir) {
          this.currentDir = newDir;
          this.playAnim('walk');
        }
      }
    }

    // Update label positions
    this.nameLabel.x = this.sprite.x;
    this.nameLabel.y = this.sprite.y - 30;
    this.statusText.x = this.sprite.x;
    this.statusText.y = this.sprite.y + 26;

    // Update status text
    const stateLabels = {
      idle: '· · ·',
      wander: 'patrolling',
      walkToStation: 'returning',
      working: 'working',
      walkToMeeting: 'convening',
      talking: 'listening'
    };
    this.statusText.setText(stateLabels[this.fsm.currentState] || '');
  }

  destroy() {
    this.sprite.destroy();
    this.nameLabel.destroy();
    this.statusText.destroy();
  }
}
