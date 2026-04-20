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
    // Initial frame: idle row (char-row 1), facing direction from config
    // Direction offsets: right=0, up=6, left=12, down=18 (each × 6 frames)
    const dirFrameOffset = { down: 18, up: 6, left: 12, right: 0 };
    const initialFrame = 1 * 56 + (dirFrameOffset[this.currentDir] || 18);
    this.sprite = scene.add.sprite(config.station.x, config.station.y, config.spriteKey, initialFrame);
    this.sprite.setOrigin(0.5, 1);
    // Per-agent depth: front-facing (Mina/James) between layers 2-3,
    // back-facing (Carl/Larry) above decoration at layer 6.5
    const agentDepth = config.facingDir === 'up' ? 6.5 : 2.5;
    this.sprite.setDepth(agentDepth);
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
    // Lock facing direction per agent config (default: down = front-facing)
    this.currentDir = config.facingDir || 'down';

    // Create animations
    this.createAnimations();

    // Initialize FSM
    this.fsm = new AgentFSM(this);

    // Start idle immediately with locked facing
    scene.time.delayedCall(Phaser.Math.Between(500, 2000), () => {
      this.fsm.transition('idle');
    });
  }

  createAnimations() {
    // Animations are now created in BootScene.createCharacterAnimations()
    // using the LimeZu spritesheet layout. Nothing to do here.
  }

  playAnim(type) {
    const key = this.config.spriteKey;
    if (type === 'idle') {
      this.sprite.play(`${key}_idle_${this.currentDir}`, true);
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
  }

  destroy() {
    this.sprite.destroy();
  }
}
