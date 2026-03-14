import { create } from "zustand";
import type { Team } from "../types/models";

interface TeamState {
  teams: Team[];
  setTeam: (team: Team) => void;
  setAll: (teams: Team[]) => void;
}

export const useTeamStore = create<TeamState>((set) => ({
  teams: [],

  setTeam: (team) =>
    set((state) => {
      const idx = state.teams.findIndex((t) => t.teamName === team.teamName);
      if (idx >= 0) {
        const next = [...state.teams];
        next[idx] = team;
        return { teams: next };
      }
      return { teams: [...state.teams, team] };
    }),

  setAll: (teams) => set({ teams }),
}));
