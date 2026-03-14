import type { Store } from "../store/Store.js";
import { config } from "../config.js";

/**
 * Periodically checks whether processes backing active sessions are still
 * alive.  When a PID is no longer running, the session and its agents are
 * marked as ended/completed.
 */
export class PidChecker {
  private store: Store;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(store: Store) {
    this.store = store;
  }

  start(): void {
    this.timer = setInterval(() => this.check(), config.pidCheckInterval);
    console.log(`[dashboard] pid checker started (every ${config.pidCheckInterval}ms)`);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log("[dashboard] pid checker stopped");
    }
  }

  private check(): void {
    const state = this.store.getFullState();
    const now = new Date().toISOString();

    for (const session of state.sessions) {
      if (session.status !== "active" || session.pid === 0) continue;

      if (!isPidAlive(session.pid)) {
        console.log(`[dashboard] pid ${session.pid} dead — ending session ${session.sessionId}`);

        // Mark all agents in the session as completed
        const agents = this.store.getAgentsBySession(session.sessionId);
        for (const agent of agents) {
          if (agent.status !== "completed") {
            this.store.upsertAgent({
              ...agent,
              status: "completed",
              endedAt: now,
              lastActivity: now,
            });
          }
        }

        this.store.removeSession(session.sessionId);
      }
    }
  }
}

/**
 * Check whether a PID is alive using signal 0.
 * This does not actually send a signal; the kernel just reports whether the
 * process exists and is reachable.
 */
function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
