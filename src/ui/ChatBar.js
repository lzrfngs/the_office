/**
 * ChatBar — DOM-based chat UI below the Phaser canvas.
 * Handles agent tab selection, message display, and input.
 * Communicates with the game via events.
 */

import Phaser from 'phaser';
import { AGENTS } from '../agents/prompts.js';
import { ChatHistory } from './ChatHistory.js';

export class ChatBar {
  constructor() {
    this.chatHistory = new ChatHistory();
    this.currentAgentId = null;
    this.isWaiting = false;
    this.onSendMessage = null; // callback: (agentId, message) => Promise<string>

    this.tabsEl = document.getElementById('agent-tabs');
    this.messagesEl = document.getElementById('chat-messages');
    this.inputEl = document.getElementById('chat-input');
    this.loadingEl = document.getElementById('chat-loading');
    this.emptyEl = document.getElementById('chat-empty');

    this.buildTabs();
    this.bindInput();
  }

  buildTabs() {
    for (const agent of AGENTS) {
      const tab = document.createElement('button');
      tab.className = 'agent-tab';
      tab.textContent = agent.name;
      tab.dataset.agentId = agent.id;
      tab.style.setProperty('--agent-color', agent.accentColor);
      tab.addEventListener('click', () => this.selectAgent(agent.id));
      this.tabsEl.appendChild(tab);
    }
  }

  bindInput() {
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.inputEl.value.trim() && !this.isWaiting) {
        this.sendMessage(this.inputEl.value.trim());
        this.inputEl.value = '';
      }
    });
  }

  selectAgent(agentId) {
    this.currentAgentId = agentId;

    // Update tab styles
    this.tabsEl.querySelectorAll('.agent-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.agentId === agentId);
    });

    // Update input placeholder
    const agent = AGENTS.find(a => a.id === agentId);
    this.inputEl.placeholder = `say something to ${agent.name}...`;

    // Focus input
    this.inputEl.focus();

    // Render messages for this agent
    this.renderMessages();
  }

  renderMessages() {
    this.messagesEl.innerHTML = '';

    if (!this.currentAgentId) return;

    const agent = AGENTS.find(a => a.id === this.currentAgentId);
    const messages = this.chatHistory.getMessages(this.currentAgentId);

    if (messages.length === 0) return;

    for (const msg of messages) {
      const div = document.createElement('div');
      div.className = msg.role === 'user' ? 'msg msg-user' : 'msg msg-agent';

      if (msg.role === 'assistant') {
        div.style.setProperty('--agent-color', agent.accentColor);
        div.innerHTML = `<div class="msg-name">${agent.name}</div>${this.escapeHtml(msg.content)}`;
      } else {
        div.textContent = msg.content;
      }

      this.messagesEl.appendChild(div);
    }

    // Scroll to bottom
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  async sendMessage(text) {
    if (!this.currentAgentId || this.isWaiting) return;

    // Add user message
    this.chatHistory.addMessage(this.currentAgentId, 'user', text);
    this.renderMessages();

    // Show loading
    this.isWaiting = true;
    this.animateLoading();

    let reply;
    try {
      if (this.onSendMessage) {
        reply = await this.onSendMessage(this.currentAgentId, text);
      } else {
        reply = this.getFallback(this.currentAgentId);
      }
    } catch (err) {
      console.warn('Chat error:', err.message);
      reply = this.getFallback(this.currentAgentId);
    }

    // Add agent response
    this.chatHistory.addMessage(this.currentAgentId, 'assistant', reply);
    this.isWaiting = false;
    this.loadingEl.textContent = '';
    this.renderMessages();

    return reply;
  }

  animateLoading() {
    const dots = ['·', '· ·', '· · ·', '· ·', '·'];
    let i = 0;
    const interval = setInterval(() => {
      if (!this.isWaiting) {
        clearInterval(interval);
        this.loadingEl.textContent = '';
        return;
      }
      this.loadingEl.textContent = dots[i % dots.length];
      i++;
    }, 300);
  }

  getFallback(agentId) {
    const responses = {
      mina: [
        'Got it. I\'ll add that to the board.',
        'Let me check the status on that.',
        'Already on it. Give me a sec.',
        'I\'ll loop in the team.',
        'Noted. Moving that up in priority.'
      ],
      james: [
        'I\'ve been reading into that. Interesting pattern.',
        'The data points in a few directions. Let me narrow it down.',
        'There\'s a signal here. Need to dig deeper.',
        'I\'ll pull together some findings.',
        'Worth investigating. I\'ll have something by end of day.'
      ],
      carl: [
        'I can put that together.',
        'What format do you need? Deck or doc?',
        'Give me the key points and I\'ll draft it up.',
        'Already have a template for that.',
        'I\'ll have a first pass ready shortly.'
      ],
      larry: [
        'On it! ...wait, what exactly did you need?',
        'I can totally handle that.',
        'Already looking into it!',
        'Sure thing. Let me just figure out where that file is.',
        'I\'m on it. Learning as I go.'
      ]
    };
    const pool = responses[agentId] || responses.larry;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
