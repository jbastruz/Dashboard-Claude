import { useEffect, useRef } from "react";
import { Monitor } from "lucide-react";
import { useTmuxStore } from "../../stores/tmuxStore";
import { fr } from "../../lib/fr";
import type { TmuxPane } from "../../types/models";

function PaneBlock({ pane }: { pane: TmuxPane }) {
  const contentRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [pane.content]);

  return (
    <div className="flex flex-col rounded-lg border border-claude-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-claude-border bg-claude-surface px-3 py-2">
        <Monitor className="h-3.5 w-3.5 text-claude-text-secondary" />
        <span className="text-xs font-medium text-claude-text">
          {pane.sessionName}
        </span>
        <span className="text-xs text-claude-text-secondary">
          {fr.monitoring.pane} {pane.windowIndex}:{pane.paneIndex}
        </span>
        {pane.title && (
          <span className="ml-auto text-xs text-claude-text-secondary truncate">
            {pane.title}
          </span>
        )}
        {pane.active && (
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        )}
      </div>

      {/* Terminal content */}
      <pre
        ref={contentRef}
        className="h-64 overflow-auto bg-[#0a0a0f] p-3 font-mono text-xs leading-relaxed text-green-400/90 scrollbar-thin"
      >
        {pane.content || "\n"}
      </pre>
    </div>
  );
}

function UnavailableState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-claude-surface border border-claude-border">
        <Monitor className="h-8 w-8 text-claude-text-secondary" />
      </div>
      <h2 className="text-lg font-semibold text-claude-text">
        {fr.monitoring.unavailable}
      </h2>
      <p className="max-w-md text-sm text-claude-text-secondary">
        {fr.monitoring.unavailableHint}
      </p>
    </div>
  );
}

export default function MonitoringView() {
  const available = useTmuxStore((s) => s.available);
  const sessions = useTmuxStore((s) => s.sessions);

  if (!available) {
    return <UnavailableState />;
  }

  const allPanes = sessions.flatMap((s) => s.panes);

  if (allPanes.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <Monitor className="h-8 w-8 text-claude-text-secondary" />
        <p className="text-sm text-claude-text-secondary">
          {fr.monitoring.noSessions}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-claude-text">
        {fr.monitoring.title}
      </h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {allPanes.map((pane) => (
          <PaneBlock key={pane.paneId} pane={pane} />
        ))}
      </div>
    </div>
  );
}
