import { create } from "zustand";
import type { TmuxPane, TmuxSession } from "../types/models";

interface TmuxState {
  available: boolean;
  sessions: TmuxSession[];
  setSessions: (available: boolean, sessions: TmuxSession[]) => void;
  updatePane: (pane: TmuxPane) => void;
}

export const useTmuxStore = create<TmuxState>((set) => ({
  available: false,
  sessions: [],

  setSessions: (available, sessions) => set({ available, sessions }),

  updatePane: (pane) =>
    set((state) => {
      const sessions = state.sessions.map((session) => {
        if (session.sessionName !== pane.sessionName) return session;
        const idx = session.panes.findIndex((p) => p.paneId === pane.paneId);
        if (idx < 0) {
          return { ...session, panes: [...session.panes, pane] };
        }
        const panes = [...session.panes];
        panes[idx] = pane;
        return { ...session, panes };
      });
      return { sessions };
    }),
}));
