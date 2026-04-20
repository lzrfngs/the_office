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
          this.stateDuration = Phaser.Math.Between(5000, 15000);
          this.agent.playAnim('idle');
        },
        update: (dt) => {
          this.stateTime += dt;
          if (this.stateTime >= this.stateDuration) {
            // Agents stay at their desks most of the time
            // Occasional brief stretch — stay idle with new duration
            this.transition('idle');
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
          const tx = Phaser.Math.Clamp(targetX, 80, 1200);
          const ty = Phaser.Math.Clamp(targetY, 80, 640);
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
          // Walk to the conference table
          this.agent.walkTo(580, 420, () => {
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
