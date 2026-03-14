import { useState } from "react";
import { Folder, Power } from "lucide-react";
import type { Session } from "../../types/models";
import { fr } from "../../lib/fr";
import { timeAgo } from "../../lib/formatters";
import { useAgentStore, useRelevantAgents } from "../../stores/agentStore";
import { useRelevantTasks } from "../../stores/taskStore";
import { useWsStore } from "../../stores/wsStore";
import { useChatStore } from "../../stores/chatStore";
import { stopSession } from "../../api/rest";
import WsStatusDot from "../WsStatusDot";
import ThemeToggle from "./ThemeToggle";

interface HeaderProps {
  session: Session;
}

export default function Header({ session }: HeaderProps) {
  const agentCount = useRelevantAgents().length;
  const taskCount = useRelevantTasks().length;
  const wsStatus = useWsStore((s) => s.status);
  const activeChatAgentId = useChatStore((s) => s.activeChatAgentId);
  const chatAgent = useAgentStore((s) =>
    activeChatAgentId ? s.agents.find((a) => a.agentId === activeChatAgentId) : undefined,
  );
  const [isStopping, setIsStopping] = useState(false);

  const handleStop = async () => {
    setIsStopping(true);
    try {
      await stopSession(session.sessionId);
    } catch {
      // Session end will be detected via WS event regardless
      setIsStopping(false);
    }
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-claude-border bg-claude-surface px-4">
      {/* Left: session info */}
      <div className="flex items-center gap-3 text-sm">
        <Folder className="h-4 w-4 text-claude-text-secondary" />
        <span className="font-mono text-claude-text">{session.cwd}</span>
        <span className="text-claude-text-secondary">
          {fr.header.since} {timeAgo(session.startedAt)}
        </span>
      </div>

      {/* Right: badges + ws status */}
      <div className="flex items-center gap-4">
        {chatAgent && (
          <span className="flex items-center gap-1.5 rounded-md bg-claude-orange/10 px-2.5 py-1 text-xs text-claude-orange">
            {fr.agent.inConversation} — {chatAgent.name}
          </span>
        )}
        <span className="flex items-center gap-1.5 rounded-md bg-claude-overlay px-2.5 py-1 text-xs text-claude-text-secondary">
          <span className="font-semibold text-claude-text">{agentCount}</span>{" "}
          {fr.header.agents}
        </span>

        <span className="flex items-center gap-1.5 rounded-md bg-claude-overlay px-2.5 py-1 text-xs text-claude-text-secondary">
          <span className="font-semibold text-claude-text">{taskCount}</span>{" "}
          {fr.header.tasks}
        </span>

        <button
          type="button"
          onClick={handleStop}
          disabled={isStopping}
          className="flex items-center gap-1.5 rounded-md bg-red-500/10 px-2.5 py-1 text-xs text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
          title={fr.header.stopSession}
        >
          <Power className="h-3.5 w-3.5" />
          {isStopping ? fr.header.stopping : fr.header.stopSession}
        </button>

        <ThemeToggle />
        <WsStatusDot status={wsStatus} />
      </div>
    </header>
  );
}
