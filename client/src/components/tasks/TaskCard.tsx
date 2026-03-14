import { AlertTriangle } from "lucide-react";
import type { Task } from "../../types/models";
import { timeAgo, truncate } from "../../lib/formatters";
import { fr } from "../../lib/fr";

interface TaskCardProps {
  task: Task;
}

export default function TaskCard({ task }: TaskCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-claude-border bg-claude-bg p-3 fade-in">
      {/* Subject */}
      <h4 className="text-sm font-medium text-claude-text">
        {truncate(task.subject, 60)}
      </h4>

      {/* Owner */}
      {task.ownerName && (
        <p className="text-xs text-claude-text-secondary">
          {fr.task.owner}: <span className="text-claude-text">{task.ownerName}</span>
        </p>
      )}

      {/* Blocked by */}
      {task.blockedBy.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-amber-400">
          <AlertTriangle className="h-3 w-3" />
          <span>{fr.task.blockedBy}: {task.blockedBy.length}</span>
        </div>
      )}

      {/* Updated */}
      <p className="mt-auto text-[11px] text-claude-text-secondary">
        {timeAgo(task.updatedAt)}
      </p>
    </div>
  );
}
