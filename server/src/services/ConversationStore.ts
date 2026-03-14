import { EventEmitter } from "node:events";
import crypto from "node:crypto";
import { config } from "../config.js";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ConversationEntry {
  id: string;
  role: "user" | "assistant" | "system" | "tool_call" | "tool_result" | "thinking";
  content: string;
  timestamp: string;
  toolName?: string;
  toolInput?: string;
  isStreaming?: boolean;
}

export interface ConversationStoreEvents {
  "conversation:update": [data: { targetId: string; entries: ConversationEntry[] }];
}

// ──────────────────────────────────────────────
// ConversationStore
// ──────────────────────────────────────────────

export class ConversationStore extends EventEmitter {
  private conversations = new Map<string, ConversationEntry[]>();

  /**
   * Append a single entry to a conversation.
   */
  appendEntry(targetId: string, entry: ConversationEntry): void {
    if (!entry.id) {
      entry.id = crypto.randomUUID();
    }
    let entries = this.conversations.get(targetId) ?? [];
    entries.push(entry);

    // Cap entries per conversation to prevent unbounded growth
    if (entries.length > config.maxConversationEntries) {
      entries = entries.slice(-config.maxConversationEntries);
    }

    this.conversations.set(targetId, entries);
    this.emit("conversation:update", { targetId, entries: [entry] });
  }

  /**
   * Append multiple entries to a conversation.
   */
  appendEntries(targetId: string, newEntries: ConversationEntry[]): void {
    if (newEntries.length === 0) return;
    let entries = this.conversations.get(targetId) ?? [];
    for (const entry of newEntries) {
      if (!entry.id) {
        entry.id = crypto.randomUUID();
      }
      entries.push(entry);
    }

    // Cap entries per conversation to prevent unbounded growth
    if (entries.length > config.maxConversationEntries) {
      entries = entries.slice(-config.maxConversationEntries);
    }

    this.conversations.set(targetId, entries);
    this.emit("conversation:update", { targetId, entries: newEntries });
  }

  /**
   * Get the full conversation for a target.
   */
  getConversation(targetId: string): ConversationEntry[] {
    return this.conversations.get(targetId) ?? [];
  }

  /**
   * Get conversation entries starting from an offset.
   */
  getConversationSince(targetId: string, offset: number): ConversationEntry[] {
    const entries = this.conversations.get(targetId) ?? [];
    return entries.slice(offset);
  }

  /**
   * Remove a conversation entirely (e.g. when an agent completes).
   */
  removeConversation(targetId: string): void {
    this.conversations.delete(targetId);
  }
}
