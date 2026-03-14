import type { Task } from "../../types/models";
import { fr } from "../../lib/fr";
import TaskCard from "./TaskCard";

interface TaskColumnProps {
  label: string;
  tasks: Task[];
}

export default function TaskColumn({ label, tasks }: TaskColumnProps) {
  return (
    <div className="flex min-h-0 flex-col rounded-lg border border-claude-border bg-claude-surface">
      {/* Column header */}
      <div className="flex items-center justify-between border-b border-claude-border px-4 py-3">
        <h3 className="text-sm font-semibold text-claude-text">{label}</h3>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-claude-overlay px-1.5 text-[10px] font-semibold text-claude-text-secondary">
          {tasks.length}
        </span>
      </div>

      {/* Task list */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        {tasks.length === 0 ? (
          <p className="py-8 text-center text-xs text-claude-text-secondary">
            {fr.task.noTasks}
          </p>
        ) : (
          tasks.map((task) => <TaskCard key={task.taskId} task={task} />)
        )}
      </div>
    </div>
  );
}
