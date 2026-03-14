import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { Agent } from "../types/models";
import { useActiveSession } from "./sessionStore";

interface AgentState {
  agents: Agent[];
  selectedAgentId: string | null;
  setAgent: (agent: Agent) => void;
  updateAgent: (partial: Partial<Agent> & { agentId: string }) => void;
  removeAgent: (agentId: string) => void;
  setAll: (agents: Agent[]) => void;
  selectAgent: (agentId: string | null) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  agents: [],
  selectedAgentId: null,

  setAgent: (agent) =>
    set((state) => {
      const idx = state.agents.findIndex((a) => a.agentId === agent.agentId);
      if (idx >= 0) {
        const next = [...state.agents];
        next[idx] = agent;
        return { agents: next };
      }
      return { agents: [...state.agents, agent] };
    }),

  updateAgent: (partial) =>
    set((state) => {
      const idx = state.agents.findIndex((a) => a.agentId === partial.agentId);
      if (idx < 0) return state;
      const next = [...state.agents];
      next[idx] = { ...next[idx], ...partial };
      return { agents: next };
    }),

  removeAgent: (agentId) =>
    set((state) => ({
      agents: state.agents.filter((a) => a.agentId !== agentId),
    })),

  setAll: (agents) => set({ agents }),

  selectAgent: (agentId) => set({ selectedAgentId: agentId }),
}));


export function useSelectedAgent(): Agent | undefined {
  return useAgentStore((state) =>
    state.agents.find((a) => a.agentId === state.selectedAgentId),
  );
}

/**
 * Returns the teamName of the active team (if any agent in the active session has one).
 */
export function useActiveTeamName(): string | null {
  const activeSession = useActiveSession();
  return useAgentStore((state) => {
    if (!activeSession) return null;
    const teamAgent = state.agents.find(
      (a) => a.sessionId === activeSession.sessionId && a.teamName,
    );
    return teamAgent?.teamName ?? null;
  });
}

/**
 * Returns agents matching the active session OR the active team's teamName.
 */
export function useRelevantAgents(): Agent[] {
  const activeSession = useActiveSession();
  const teamName = useActiveTeamName();
  return useAgentStore(
    useShallow((state) => {
      if (!activeSession) return state.agents;
      return state.agents.filter(
        (a) =>
          a.sessionId === activeSession.sessionId ||
          (teamName && a.teamName === teamName),
      );
    }),
  );
}
