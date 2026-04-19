/**
 * AgentFSM — Finite State Machine for agent behavior.
 * States: idle, wander, walkToStation, working, walkToMeeting, talking
 * 
 * Each state has enter/update/exit hooks. Transitions are time-based
 * or triggered by external events (click, meeting call).
 */

import Phaser from 'phaser';

export class AgentFSM {
  constructor(agent) {
    this.agent = agent;
    this.currentState = 'idle';
    this.stateTime = 0;
    this.stateDuration = 0;

    this.states = {
      idle: {
        enter: () => {
          this.stateDuration = Phaser.Math.Between(2000, 5000);
          this.agent.playAnim('idle');
        },
        update: (dt) => {
          this.stateTime += dt;
          if (this.stateTime >= this.stateDuration) {
            // Randomly decide next action
            const roll = Math.random();
            if (roll < 0.5) {
              this.transition('wander');
            } else if (roll < 0.8) {
              this.transition('walkToStation');
            } else {
              this.transition('idle'); // stay idle a bit longer
            }
          }
        }
      },

      wander: {
        enter: () => {
          // Pick a random point within wander radius of station
          const station = this.agent.config.station;
          const radius = this.agent.config.wanderRadius;
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * radius;
          const targetX = station.x + Math.cos(angle) * dist;
          const targetY = station.y + Math.sin(angle) * dist;
          // Clamp to world bounds
          const tx = Phaser.Math.Clamp(targetX, 40, 1240);
          const ty = Phaser.Math.Clamp(targetY, 40, 680);
          this.agent.walkTo(tx, ty, () => {
            this.transition('idle');
          });
        },
        update: () => {}
      },

      walkToStation: {
        enter: () => {
          const station = this.agent.config.station;
          // Walk near the station, not exactly on it
          const offsetX = Phaser.Math.Between(-15, 15);
          const offsetY = Phaser.Math.Between(-15, 15);
          this.agent.walkTo(
            station.x + offsetX,
            station.y + offsetY,
            () => this.transition('working')
          );
        },
        update: () => {}
      },

      working: {
        enter: () => {
          this.stateDuration = Phaser.Math.Between(4000, 8000);
          this.agent.playAnim('idle');
          // Face the station
          this.agent.faceStation();
        },
        update: (dt) => {
          this.stateTime += dt;
          if (this.stateTime >= this.stateDuration) {
            this.transition('wander');
          }
        }
      },

      walkToMeeting: {
        enter: () => {
          // Walk to the central fire pit
          this.agent.walkTo(640, 400, () => {
            this.transition('idle');
          });
        },
        update: () => {}
      },

      talking: {
        enter: () => {
          this.agent.stop();
          this.agent.playAnim('idle');
        },
        update: () => {}
      }
    };
  }

  transition(newState) {
    if (this.states[this.currentState] && this.states[this.currentState].exit) {
      this.states[this.currentState].exit();
    }
    this.currentState = newState;
    this.stateTime = 0;
    if (this.states[newState] && this.states[newState].enter) {
      this.states[newState].enter();
    }
  }

  update(dt) {
    if (this.states[this.currentState] && this.states[this.currentState].update) {
      this.states[this.currentState].update(dt);
    }
  }
}
