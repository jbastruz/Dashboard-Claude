import { create } from "zustand";
import type { Session } from "../types/models";

interface SessionState {
  sessions: Session[];
  setSession: (session: Session) => void;
  removeSession: (sessionId: string) => void;
  setAll: (sessions: Session[]) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessions: [],

  setSession: (session) =>
    set((state) => {
      const idx = state.sessions.findIndex((s) => s.sessionId === session.sessionId);
      if (idx >= 0) {
        const next = [...state.sessions];
        next[idx] = session;
        return { sessions: next };
      }
      return { sessions: [...state.sessions, session] };
    }),

  removeSession: (sessionId) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.sessionId !== sessionId),
    })),

  setAll: (sessions) => set({ sessions }),
}));

export function getActiveSession(): Session | undefined {
  return useSessionStore.getState().sessions.find((s) => s.status === "active");
}

export function useActiveSession(): Session | undefined {
  return useSessionStore((state) => state.sessions.find((s) => s.status === "active"));
}
