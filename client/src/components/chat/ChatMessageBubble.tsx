import { memo, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "../../types/chat";
import { fr } from "../../lib/fr";
import { formatTime } from "../../lib/formatters";

interface ChatMessageBubbleProps {
  message: ChatMessage;
}

function ChatMessageBubbleInner({ message }: ChatMessageBubbleProps) {
  const timestamp = (
    <span className="mt-1 block text-[10px] text-claude-text-secondary">
      {formatTime(message.timestamp)}
    </span>
  );

  switch (message.role) {
    case "user":
      return (
        <div className="flex justify-end px-4 py-1.5">
          <div className="max-w-[80%] rounded-lg bg-claude-orange/10 border-l-2 border-claude-orange px-3 py-2">
            <p className={`text-sm text-claude-text whitespace-pre-wrap ${message.isStreaming ? "streaming-cursor" : ""}`}>
              {message.content}
            </p>
            {timestamp}
          </div>
        </div>
      );

    case "assistant":
      return (
        <div className="flex justify-start px-4 py-1.5">
          <div className="max-w-[80%] rounded-lg bg-claude-surface border border-claude-border px-3 py-2">
            <div className={`prose prose-sm max-w-none text-claude-text ${message.isStreaming ? "streaming-cursor" : ""}`}>
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  pre: ({ children }) => (
                    <pre className="bg-claude-code-bg p-3 rounded-md font-mono text-sm text-claude-text overflow-x-auto">
                      {children}
                    </pre>
                  ),
                  code: ({ children, className }) => {
                    const isInline = !className;
                    return isInline ? (
                      <code className="bg-claude-overlay px-1 py-0.5 rounded text-xs font-mono text-claude-text">
                        {children}
                      </code>
                    ) : (
                      <code className={className}>{children}</code>
                    );
                  },
                }}
              >
                {message.content}
              </Markdown>
            </div>
            {timestamp}
          </div>
        </div>
      );

    case "thinking":
      return <ThinkingBubble message={message} timestamp={timestamp} />;

    case "tool_call":
      return <ToolCallBubble message={message} timestamp={timestamp} />;

    case "tool_result":
      return <ToolResultBubble message={message} timestamp={timestamp} />;

    case "system":
      return (
        <div className="flex justify-center px-4 py-1.5">
          <p className="text-xs text-claude-text-secondary">{message.content}</p>
        </div>
      );

    default:
      return null;
  }
}

function ThinkingBubble({
  message,
  timestamp,
}: {
  message: ChatMessage;
  timestamp: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="flex justify-start px-4 py-1.5">
      <div className="max-w-[80%] rounded-lg border border-dashed border-claude-border px-3 py-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1 text-xs font-medium text-claude-text-secondary hover:text-claude-text"
        >
          <span>{collapsed ? "\u25B8" : "\u25BE"}</span>
          {fr.chat.thinking}
        </button>
        {!collapsed && (
          <p className="mt-2 text-sm italic text-claude-text-secondary whitespace-pre-wrap">
            {message.content}
          </p>
        )}
        {timestamp}
      </div>
    </div>
  );
}

function ToolCallBubble({
  message,
  timestamp,
}: {
  message: ChatMessage;
  timestamp: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="flex justify-start px-4 py-1.5">
      <div className="max-w-[80%] rounded-lg bg-blue-500/5 border border-blue-500/20 px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono text-blue-500">{message.toolName ?? fr.chat.toolCall}</span>
        </div>
        {message.toolInput && (
          <>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="mt-1 text-[10px] text-claude-text-secondary hover:text-claude-text"
            >
              {collapsed ? "\u25B8 JSON" : "\u25BE JSON"}
            </button>
            {!collapsed && (
              <pre className="mt-1 bg-claude-code-bg p-2 rounded-md font-mono text-xs text-claude-text-secondary overflow-x-auto max-h-60 overflow-y-auto">
                {message.toolInput}
              </pre>
            )}
          </>
        )}
        {timestamp}
      </div>
    </div>
  );
}

function ToolResultBubble({
  message,
  timestamp,
}: {
  message: ChatMessage;
  timestamp: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const lines = message.content.split("\n");
  const isTruncated = lines.length > 3;
  const displayContent = expanded ? message.content : lines.slice(0, 3).join("\n");

  return (
    <div className="flex justify-start px-4 py-1.5">
      <div className="max-w-[80%] rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-3 py-2">
        <pre className="font-mono text-xs text-claude-text-secondary whitespace-pre-wrap overflow-x-auto">
          {displayContent}
        </pre>
        {isTruncated && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 text-[10px] text-emerald-400 hover:text-emerald-300"
          >
            {expanded ? fr.chat.collapse : fr.chat.expand}
          </button>
        )}
        {timestamp}
      </div>
    </div>
  );
}

const ChatMessageBubble = memo(ChatMessageBubbleInner);
export default ChatMessageBubble;
