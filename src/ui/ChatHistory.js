/**
 * ChatHistory — localStorage-backed conversation history per agent.
 * Stores { role: 'user'|'assistant', content: string } messages.
 * Limited to last 20 messages per agent to keep context manageable.
 */

const STORAGE_KEY = 'the-office-chat';
const MAX_MESSAGES = 20;

export class ChatHistory {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // localStorage full or unavailable — continue without persistence
    }
  }

  getMessages(agentId) {
    return this.data[agentId] || [];
  }

  addMessage(agentId, role, content) {
    if (!this.data[agentId]) this.data[agentId] = [];
    this.data[agentId].push({ role, content });
    // Trim to max
    if (this.data[agentId].length > MAX_MESSAGES) {
      this.data[agentId] = this.data[agentId].slice(-MAX_MESSAGES);
    }
    this.save();
  }

  clear(agentId) {
    if (agentId) {
      delete this.data[agentId];
    } else {
      this.data = {};
    }
    this.save();
  }
}
