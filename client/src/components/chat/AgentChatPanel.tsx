import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import type { Agent } from "../../types/models";
import type { ChatMessage } from "../../types/chat";
import { useChatStore } from "../../stores/chatStore";
import { useWsStore } from "../../stores/wsStore";
import { fetchAgentConversation } from "../../api/rest";
import { toClientMessages } from "../../lib/mappers";
import { fr } from "../../lib/fr";
import ChatMessageBubble from "./ChatMessageBubble";
import StreamingIndicator from "./StreamingIndicator";

interface AgentChatPanelProps {
  agent: Agent;
}

export default function AgentChatPanel({ agent }: AgentChatPanelProps) {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages: ChatMessage[] =
    useChatStore((s) => s.messagesByAgent[agent.agentId]) ?? [];
  const streamingMessageId = useChatStore((s) => s.streamingMessageId);
  const wsClient = useWsStore((s) => s.wsClient);

  const isCompleted = agent.status === "completed";

  // Auto-scroll on new messages (only when streaming concerns this agent)
  const isStreamingHere = streamingMessageId != null &&
    messages.some((m) => m.id === streamingMessageId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isStreamingHere]);

  // Fetch existing conversation on mount
  useEffect(() => {
    fetchAgentConversation(agent.agentId)
      .then((entries) => {
        useChatStore.getState().setMessages(
          agent.agentId,
          toClientMessages(agent.agentId, entries),
        );
      })
      .catch(() => {
        // API not available yet, ignore
      });
  }, [agent.agentId]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || !wsClient || isCompleted) return;

    // Optimistic update: add user message
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      agentId: agent.agentId,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
      isStreaming: false,
    };
    useChatStore.getState().addMessage(userMsg);

    // Send via WebSocket
    wsClient.send({
      type: "command:send-message",
      requestId: crypto.randomUUID(),
      data: {
        sessionId: agent.sessionId,
        message: text,
      },
    });

    setInputText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Messages zone */}
      <div className="flex-1 overflow-y-auto py-2">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-claude-text-secondary">{fr.chat.noMessages}</p>
          </div>
        ) : (
          messages.map((msg) => <ChatMessageBubble key={msg.id} message={msg} />)
        )}
        {streamingMessageId != null && <StreamingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input zone */}
      <div className="border-t border-claude-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isCompleted}
            placeholder={isCompleted ? fr.chat.agentCompleted : fr.chat.placeholder}
            rows={2}
            className="flex-1 resize-none rounded-lg border border-claude-border bg-claude-bg p-3 text-sm text-claude-text placeholder-claude-text-secondary focus:border-claude-orange/50 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={isCompleted || !inputText.trim()}
            className="rounded-lg bg-claude-orange/20 p-2.5 text-claude-orange transition-colors hover:bg-claude-orange/30 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-[10px] text-claude-text-secondary">{fr.chat.sendHint}</p>
      </div>
    </div>
  );
}
