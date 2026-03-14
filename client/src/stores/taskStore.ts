import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { Task, TaskStatus } from "../types/models";
import { useActiveSession } from "./sessionStore";
import { useActiveTeamName } from "./agentStore";

interface TaskState {
  tasks: Task[];
  setTask: (task: Task) => void;
  setAll: (tasks: Task[]) => void;
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],

  setTask: (task) =>
    set((state) => {
      const idx = state.tasks.findIndex((t) => t.taskId === task.taskId);
      if (idx >= 0) {
        const next = [...state.tasks];
        next[idx] = task;
        return { tasks: next };
      }
      return { tasks: [...state.tasks, task] };
    }),

  setAll: (tasks) => set({ tasks }),
}));

export function useTasksByStatus(status: TaskStatus): Task[] {
  return useTaskStore(
    useShallow((state) => state.tasks.filter((t) => t.status === status)),
  );
}

/**
 * Returns tasks matching the active session OR the active team's teamName.
 */
export function useRelevantTasks(): Task[] {
  const activeSession = useActiveSession();
  const teamName = useActiveTeamName();
  return useTaskStore(
    useShallow((state) => {
      if (!activeSession) return state.tasks;
      return state.tasks.filter(
        (t) =>
          t.sessionId === activeSession.sessionId ||
          (teamName && t.teamName === teamName),
      );
    }),
  );
}
