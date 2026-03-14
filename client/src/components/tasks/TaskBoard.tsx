import { fr } from "../../lib/fr";
import { useRelevantTasks } from "../../stores/taskStore";
import TaskColumn from "./TaskColumn";
import type { TaskStatus } from "../../types/models";

interface TaskBoardProps {
  sessionId?: string;
}

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "pending", label: fr.task.pending },
  { status: "in_progress", label: fr.task.in_progress },
  { status: "completed", label: fr.task.completed },
];

export default function TaskBoard({ sessionId: _sessionId }: TaskBoardProps) {
  const tasks = useRelevantTasks();

  return (
    <div className="grid min-h-full grid-cols-3 gap-4">
      {COLUMNS.map(({ status, label }) => {
        const columnTasks = tasks.filter((t) => t.status === status);
        return (
          <TaskColumn
            key={status}
            label={label}
            tasks={columnTasks}
          />
        );
      })}
    </div>
  );
}
