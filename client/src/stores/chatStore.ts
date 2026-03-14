import { create } from "zustand";
import type { ChatMessage } from "../types/chat";

interface ChatState {
  messagesByAgent: Record<string, ChatMessage[]>;
  activeChatAgentId: string | null;
  streamingMessageId: string | null;
  setActiveChatAgent: (agentId: string | null) => void;
  addMessage: (msg: ChatMessage) => void;
  appendToStreaming: (agentId: string, messageId: string, chunk: string) => void;
  finalizeStreaming: (agentId: string, messageId: string) => void;
  setMessages: (agentId: string, messages: ChatMessage[]) => void;
  clearMessages: (agentId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messagesByAgent: {},
  activeChatAgentId: null,
  streamingMessageId: null,

  setActiveChatAgent: (agentId) => set({ activeChatAgentId: agentId }),

  addMessage: (msg) =>
    set((state) => {
      const existing = state.messagesByAgent[msg.agentId] ?? [];
      return {
        messagesByAgent: {
          ...state.messagesByAgent,
          [msg.agentId]: [...existing, msg],
        },
        streamingMessageId: msg.isStreaming ? msg.id : state.streamingMessageId,
      };
    }),

  appendToStreaming: (agentId, messageId, chunk) =>
    set((state) => {
      const messages = state.messagesByAgent[agentId];
      if (!messages) return state;
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx < 0) return state;
      const updated = [...messages];
      updated[idx] = { ...updated[idx], content: updated[idx].content + chunk };
      return {
        messagesByAgent: {
          ...state.messagesByAgent,
          [agentId]: updated,
        },
      };
    }),

  finalizeStreaming: (agentId, messageId) =>
    set((state) => {
      const messages = state.messagesByAgent[agentId];
      if (!messages) return state;
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx < 0) return state;
      const updated = [...messages];
      updated[idx] = { ...updated[idx], isStreaming: false };
      return {
        messagesByAgent: {
          ...state.messagesByAgent,
          [agentId]: updated,
        },
        streamingMessageId:
          state.streamingMessageId === messageId ? null : state.streamingMessageId,
      };
    }),

  setMessages: (agentId, messages) =>
    set((state) => ({
      messagesByAgent: {
        ...state.messagesByAgent,
        [agentId]: messages,
      },
    })),

  clearMessages: (agentId) =>
    set((state) => {
      const next = { ...state.messagesByAgent };
      delete next[agentId];
      return { messagesByAgent: next };
    }),
}));
