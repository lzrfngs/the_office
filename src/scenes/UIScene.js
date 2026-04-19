/**
 * UIScene — overlay scene with agent info + chat panel.
 * Phaser renders in canvas, so the chat input uses a DOM element
 * overlaid on top of the game.
 *
 * When an agent is clicked:
 *  - Panel slides in from right
 *  - Shows agent name, title, conversation history
 *  - Text input at bottom for sending messages
 *  - Responses appear in panel AND as speech bubbles in-world
 */

import Phaser from 'phaser';
import { ChatHistory } from '../ui/ChatHistory.js';
import { SpeechBubble } from '../ui/SpeechBubble.js';

const PANEL_W = 280;

export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
    this.chatHistory = new ChatHistory();
    this.currentAgent = null;
    this.isWaitingForResponse = false;
  }

  create() {
    // --- Panel container (slides in from right) ---
    this.panel = this.add.container(1280, 0);
    this.panel.setDepth(50);
    this.panelVisible = false;

    // Panel background
    const bg = this.add.rectangle(0, 0, PANEL_W, 720, 0x0d0b09, 0.94);
    bg.setOrigin(0, 0);
    bg.setStrokeStyle(1, 0x2a2520);
    this.panel.add(bg);

    // Agent name
    this.panelName = this.add.text(16, 18, '', {
      fontFamily: '"Courier New", monospace',
      fontSize: '20px',
      color: '#d4943a',
      stroke: '#0a0a0a',
      strokeThickness: 2
    });
    this.panel.add(this.panelName);

    // Agent title
    this.panelTitle = this.add.text(16, 38, '', {
      fontFamily: '"Courier New", monospace',
      fontSize: '13px',
      color: '#8a857e'
    });
    this.panel.add(this.panelTitle);

    // Divider
    const divider = this.add.rectangle(16, 56, PANEL_W - 32, 1, 0x2a2520);
    divider.setOrigin(0, 0);
    this.panel.add(divider);

    // Close button
    const closeBtn = this.add.text(PANEL_W - 16, 10, '×', {
      fontFamily: '"Courier New", monospace',
      fontSize: '22px',
      color: '#8a857e'
    });
    closeBtn.setOrigin(0.5, 0);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.hidePanel());
    closeBtn.on('pointerover', () => closeBtn.setColor('#d4943a'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#8a857e'));
    this.panel.add(closeBtn);

    // --- Chat message area (scrollable text) ---
    this.messagesContainer = this.add.container(0, 64);
    this.panel.add(this.messagesContainer);

    // Mask the messages area — will be repositioned when panel slides in
    this.msgMaskGraphics = this.make.graphics();
    this.msgMaskGraphics.fillRect(0, 64, PANEL_W, 586);
    this.messagesMask = this.msgMaskGraphics.createGeometryMask();
    this.messagesContainer.setMask(this.messagesMask);

    // --- Input area at bottom ---
    const inputBg = this.add.rectangle(0, 660, PANEL_W, 60, 0x111010, 0.95);
    inputBg.setOrigin(0, 0);
    inputBg.setStrokeStyle(1, 0x2a2520);
    this.panel.add(inputBg);

    // Input prompt indicator
    this.inputPrompt = this.add.text(12, 676, '>', {
      fontFamily: '"Courier New", monospace',
      fontSize: '14px',
      color: '#7a756e'
    });
    this.panel.add(this.inputPrompt);

    // Loading indicator
    this.loadingText = this.add.text(PANEL_W / 2, 650, '', {
      fontFamily: '"Courier New", monospace',
      fontSize: '12px',
      color: '#8a857e',
      align: 'center'
    });
    this.loadingText.setOrigin(0.5, 1);
    this.panel.add(this.loadingText);

    // Click handler — UIScene has input priority as the top scene,
    // so all click detection (agents + panel close) happens here.
    this.input.on('pointerdown', (pointer) => {
      // Check if clicking inside the panel area
      if (this.panelVisible && pointer.x >= (1280 - PANEL_W)) {
        return; // Let panel handle it
      }

      // Hit test against agent sprites in WorldScene
      const worldScene = this.scene.get('WorldScene');
      if (worldScene && worldScene.agentSprites) {
        for (const agent of worldScene.agentSprites) {
          const sprite = agent.sprite;
          const dx = Math.abs(pointer.x - sprite.x);
          const dy = Math.abs(pointer.y - sprite.y);
          if (dx < 50 && dy < 60) {
            this.showPanel(agent.config);
            return;
          }
        }
      }

      // Clicked on empty space — close panel if open
      if (this.panelVisible) {
        this.hidePanel();
      }
    });

    // --- Create DOM input element ---
    this.createDOMInput();
  }

  createDOMInput() {
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'grove-chat-input';
    input.placeholder = 'speak...';
    input.autocomplete = 'off';
    input.style.cssText = `
      position: fixed;
      bottom: -100px;
      right: -100px;
      width: 200px;
      height: 26px;
      background: #111010;
      border: 1px solid #2a2520;
      border-radius: 2px;
      color: #c8c4be;
      font-family: "Courier New", monospace;
      font-size: 14px;
      padding: 6px 8px;
      outline: none;
      z-index: 100;
      display: none;
    `;

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim() && !this.isWaitingForResponse) {
        this.sendMessage(input.value.trim());
        input.value = '';
      }
      e.stopPropagation();
    });

    // Prevent Phaser from stealing focus
    input.addEventListener('mousedown', (e) => e.stopPropagation());
    input.addEventListener('pointerdown', (e) => e.stopPropagation());

    document.body.appendChild(input);
    this.domInput = input;
  }

  positionDOMInput() {
    if (!this.domInput || !this.panelVisible) return;

    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / 1280;
    const scaleY = rect.height / 720;

    const panelScreenX = rect.left + (1280 - PANEL_W) * scaleX;
    const inputScreenY = rect.top + 670 * scaleY;

    this.domInput.style.left = `${panelScreenX + 26 * scaleX}px`;
    this.domInput.style.top = `${inputScreenY}px`;
    this.domInput.style.width = `${(PANEL_W - 52) * scaleX}px`;
    this.domInput.style.height = `${26 * scaleY}px`;
    this.domInput.style.fontSize = `${Math.max(10, 11 * scaleY)}px`;
    this.domInput.style.display = 'block';
  }

  hideDOMInput() {
    if (this.domInput) {
      this.domInput.style.display = 'none';
      this.domInput.blur();
    }
  }

  showPanel(agentConfig) {
    this.currentAgent = agentConfig;
    this.panelName.setText(agentConfig.name);
    this.panelName.setColor(agentConfig.accentColor);
    this.panelTitle.setText(agentConfig.title);

    this.renderMessages();

    const targetX = 1280 - PANEL_W;

    const onReady = () => {
      // Reposition mask for slid-in panel
      this.msgMaskGraphics.clear();
      this.msgMaskGraphics.fillRect(targetX, 64, PANEL_W, 586);
      this.messagesMask = this.msgMaskGraphics.createGeometryMask();
      this.messagesContainer.setMask(this.messagesMask);
      this.positionDOMInput();
    };

    if (!this.panelVisible) {
      this.panelVisible = true;
      this.tweens.add({
        targets: this.panel,
        x: targetX,
        duration: 300,
        ease: 'Power2',
        onComplete: onReady
      });
    } else {
      onReady();
    }

    // Transition agent to talking state
    const worldScene = this.scene.get('WorldScene');
    const agentSprite = worldScene.agentSprites.find(a => a.config.id === agentConfig.id);
    if (agentSprite) {
      agentSprite.fsm.transition('talking');
    }
  }

  hidePanel() {
    if (!this.panelVisible) return;

    this.panelVisible = false;
    this.hideDOMInput();

    // Release agent from talking state
    if (this.currentAgent) {
      const worldScene = this.scene.get('WorldScene');
      const agentSprite = worldScene.agentSprites.find(a => a.config.id === this.currentAgent.id);
      if (agentSprite && agentSprite.fsm.currentState === 'talking') {
        agentSprite.fsm.transition('idle');
      }
    }

    this.tweens.add({
      targets: this.panel,
      x: 1280,
      duration: 250,
      ease: 'Power2',
      onComplete: () => {
        this.currentAgent = null;
      }
    });
  }

  renderMessages() {
    this.messagesContainer.removeAll(true);
    if (!this.currentAgent) return;

    const messages = this.chatHistory.getMessages(this.currentAgent.id);
    let yOffset = 4;

    for (const msg of messages) {
      const isUser = msg.role === 'user';
      const color = isUser ? '#8a857e' : '#c8c4be';
      const prefix = isUser ? '> ' : '';

      const text = this.add.text(14, yOffset, prefix + msg.content, {
        fontFamily: '"Courier New", monospace',
        fontSize: '13px',
        color: color,
        wordWrap: { width: PANEL_W - 36 },
        lineSpacing: 4
      });

      if (!isUser) {
        const bar = this.add.rectangle(4, yOffset + 2, 2, text.height - 4,
          Phaser.Display.Color.HexStringToColor(this.currentAgent.accentColor).color, 0.5);
        bar.setOrigin(0, 0);
        this.messagesContainer.add(bar);
      }

      this.messagesContainer.add(text);
      yOffset += text.height + 10;
    }

    // Scroll to bottom
    const visibleHeight = 586;
    const maxScroll = Math.max(0, yOffset - visibleHeight);
    this.messagesContainer.y = 64 - maxScroll;
  }

  async sendMessage(text) {
    if (!this.currentAgent || this.isWaitingForResponse) return;

    this.chatHistory.addMessage(this.currentAgent.id, 'user', text);
    this.renderMessages();

    this.isWaitingForResponse = true;
    this.loadingText.setText('· · ·');
    this.animateLoading();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: this.currentAgent.id,
          message: text,
          history: this.chatHistory.getMessages(this.currentAgent.id).slice(0, -1)
        })
      });

      if (!response.ok) throw new Error(`API ${response.status}`);

      const data = await response.json();
      const reply = data.reply || 'No response.';

      this.chatHistory.addMessage(this.currentAgent.id, 'assistant', reply);
      this.renderMessages();
      this.showSpeechBubble(this.currentAgent, reply);
    } catch (err) {
      console.warn('Chat API unavailable, using fallback:', err.message);
      const fallback = this.getFallbackResponse(this.currentAgent.id);
      this.chatHistory.addMessage(this.currentAgent.id, 'assistant', fallback);
      this.renderMessages();
      this.showSpeechBubble(this.currentAgent, fallback);
    }

    this.isWaitingForResponse = false;
    this.loadingText.setText('');
  }

  animateLoading() {
    const dots = ['·', '· ·', '· · ·', '· ·', '·'];
    let i = 0;
    this.loadingTimer = this.time.addEvent({
      delay: 300,
      loop: true,
      callback: () => {
        if (!this.isWaitingForResponse) {
          if (this.loadingTimer) this.loadingTimer.remove();
          return;
        }
        this.loadingText.setText(dots[i % dots.length]);
        i++;
      }
    });
  }

  showSpeechBubble(agentConfig, text) {
    const worldScene = this.scene.get('WorldScene');
    const agentSprite = worldScene.agentSprites.find(a => a.config.id === agentConfig.id);
    if (!agentSprite) return;

    const bubbleText = text.length > 80 ? text.substring(0, 77) + '...' : text;
    new SpeechBubble(
      worldScene,
      agentSprite.sprite.x,
      agentSprite.sprite.y - 20,
      bubbleText,
      agentConfig.accentColor,
      6000
    );
  }

  getFallbackResponse(agentId) {
    const responses = {
      scout: [
        'The perimeter holds. Nothing stirs... yet.',
        'I see what you mean. Let me look into it.',
        'Noted. I\'ll keep watch.',
        'Something moved in the treeline. Probably nothing.',
        'The lantern burns steady. That\'s usually a good sign.'
      ],
      blacksmith: [
        'I\'ll hammer that into shape.',
        'The forge is hot. Let\'s get to work.',
        'That can be built. Give me a moment.',
        'Every plan needs a good foundation.',
        'Schedule\'s clear enough. I can work with that.'
      ],
      oracle: [
        'The sigils whisper of convergence...',
        'I see threads forming. Not all of them kind.',
        'The pattern is familiar, but shifted.',
        'Look beyond the immediate. There\'s a deeper current.',
        'Three signals. One meaning. Give it time.'
      ]
    };
    const pool = responses[agentId] || responses.scout;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Alias for WorldScene click handler compatibility
  showAgentInfo(agentConfig) {
    this.showPanel(agentConfig);
  }

  update() {
    if (this.panelVisible) {
      this.positionDOMInput();
    }
  }
}
