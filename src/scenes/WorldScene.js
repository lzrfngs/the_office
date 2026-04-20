/**
 * WorldScene — office environment for The Grove.
 * Loads a Tiled JSON map with LimeZu Modern Office tileset.
 * Characters are placed on top at their desk positions.
 */

import Phaser from 'phaser';
import { AGENTS } from '../agents/prompts.js';
import { AgentSprite } from '../agents/AgentSprite.js';
import { Pathfinder } from '../world/pathfinding.js';
import { SpeechBubble } from '../ui/SpeechBubble.js';

export class WorldScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WorldScene' });
    this.agentSprites = [];
  }

  create() {
    this.pathfinder = new Pathfinder();
    this.recentEvents = []; // tracks recent agent actions for context
    this.conversationInProgress = false; // prevents overlapping conversations

    // Load Tiled map
    const map = this.make.tilemap({ key: 'office' });

    // Add tilesets — names must match the tileset names in the Tiled JSON
    const roomTileset = map.addTilesetImage('Room_Builder_Office_48x48');
    const officeTileset = map.addTilesetImage('Modern_Office_Shadowless_48x48');
    const allTilesets = [roomTileset, officeTileset];

    // Create all layers with explicit depth ordering
    // Characters sit at depth 7
    // Reference layers (plant markers) are hidden
    const layerDepths = {
      '0-Base': 0,
      '1-Back Wall': 1,
      '2-Front Chairs': 2,
      '4-Cubicles': 3,
      '5-Desks': 4,
      '6-Decoration': 5,
      'Borders': 6,
      // Characters render at depth 7
      'Back Facing Chairs': 8,
      // Hidden reference layers
      '3-Front Facing Character': -1,
      '7- Facing Character': -1
    };

    const layerNames = map.layers.map(l => l.name);
    layerNames.forEach((name) => {
      const depth = layerDepths[name];
      if (depth === -1) return; // skip hidden reference layers
      const layer = map.createLayer(name, allTilesets, 0, 0);
      if (layer) {
        layer.setDepth(depth ?? 1);
      }
    });

    // Spawn agents
    for (const agentConfig of AGENTS) {
      const agent = new AgentSprite(this, agentConfig, this.pathfinder);
      this.agentSprites.push(agent);
    }

    // Start UI scene
    this.scene.launch('UIScene');

    // Start autonomous thinking loop — staggered per agent
    this.startThinkLoops();
  }

  /**
   * Start periodic think timers for each agent.
   * Each agent thinks every 30-90 seconds, staggered so they don't all fire at once.
   */
  startThinkLoops() {
    this.agentSprites.forEach((agent, index) => {
      // Stagger first think by 10-20 seconds + agent index offset
      const initialDelay = Phaser.Math.Between(10000, 20000) + index * 5000;

      this.time.delayedCall(initialDelay, () => {
        this.agentThink(agent);
        // Then repeat every 40-90 seconds
        this.time.addEvent({
          delay: Phaser.Math.Between(40000, 90000),
          loop: true,
          callback: () => this.agentThink(agent)
        });
      });
    });
  }

  /**
   * An agent "thinks" — calls the API to decide what to do.
   */
  async agentThink(agentSprite) {
    if (this.conversationInProgress) return;

    const agentId = agentSprite.config.id;
    const worldState = {
      agents: this.agentSprites.map(a => ({
        id: a.config.id,
        name: a.config.name,
        title: a.config.title
      })),
      recentEvents: this.recentEvents.slice(-5)
    };

    try {
      const response = await fetch('/api/think', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: agentId, worldState })
      });

      if (!response.ok) return;
      const result = await response.json();

      if (result.action === 'speak' && result.target && result.message) {
        // Start a conversation between this agent and the target
        this.startConversation(agentId, result.target, result.message);
      }
      // idle actions are silent — no visible effect
    } catch (err) {
      console.warn(`Think error for ${agentId}:`, err.message);
    }
  }

  /**
   * Start a conversation between two agents.
   * Agent A speaks first, Agent B responds, optionally one more exchange.
   */
  async startConversation(initiatorId, targetId, openingMessage) {
    if (this.conversationInProgress) return;
    this.conversationInProgress = true;

    const initiator = this.agentSprites.find(a => a.config.id === initiatorId);
    const target = this.agentSprites.find(a => a.config.id === targetId);
    if (!initiator || !target) {
      this.conversationInProgress = false;
      return;
    }

    // Log the event
    this.addEvent(`${initiator.config.name} spoke to ${target.config.name}: "${openingMessage}"`);

    // Show opening message as speech bubble
    this.showBubble(initiatorId, openingMessage, 5000);

    // Wait for bubble to be readable, then get target's response
    await this.wait(4000);

    // Target responds
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: targetId,
          message: `${initiator.config.name} just said to you: "${openingMessage}". Reply in 8 words or less. Stay in character.`,
          history: []
        })
      });

      if (response.ok) {
        const data = await response.json();
        const reply = data.reply || '';
        if (reply) {
          this.addEvent(`${target.config.name} replied to ${initiator.config.name}: "${reply}"`);
          this.showBubble(targetId, reply, 5000);
          await this.wait(5000);
        }
      }
    } catch (err) {
      console.warn('Conversation response error:', err.message);
    }

    this.conversationInProgress = false;
  }

  /**
   * Add an event to the recent events log (used as context for future thinks).
   */
  addEvent(event) {
    this.recentEvents.push(event);
    if (this.recentEvents.length > 10) {
      this.recentEvents.shift();
    }
  }

  /**
   * Promise-based wait for sequencing conversation turns.
   */
  wait(ms) {
    return new Promise(resolve => this.time.delayedCall(ms, resolve));
  }

  /**
   * Show a speech bubble above an agent.
   * Only one bubble at a time — destroys any existing bubble first.
   */
  showBubble(agentId, text, duration = 6000) {
    const agentSprite = this.agentSprites.find(a => a.config.id === agentId);
    if (!agentSprite) return;

    // Destroy any existing bubble
    if (this.activeBubble) {
      this.activeBubble.destroy();
      this.activeBubble = null;
    }

    const agent = agentSprite.config;
    const bubbleText = text.length > 50 ? text.substring(0, 47) + '...' : text;

    this.activeBubble = new SpeechBubble(
      this,
      agentSprite.sprite.x,
      agentSprite.sprite.y - 60, // just above character head
      bubbleText,
      agent.accentColor,
      duration
    );
  }

  update(time, delta) {
    for (const agent of this.agentSprites) {
      agent.update(time, delta);
    }
  }
}
