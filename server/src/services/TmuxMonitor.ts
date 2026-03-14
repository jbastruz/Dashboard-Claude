import { EventEmitter } from "node:events";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// ── Types ──────────────────────────────────────

export interface TmuxPane {
  paneId: string;
  sessionName: string;
  windowIndex: number;
  paneIndex: number;
  content: string;
  title: string;
  active: boolean;
}

export interface TmuxSession {
  sessionName: string;
  panes: TmuxPane[];
}

export interface TmuxMonitorEvents {
  "tmux:sessions": [sessions: TmuxSession[]];
  "tmux:update": [pane: TmuxPane];
}

type TypedEventEmitter<T> = {
  on<K extends keyof T & string>(event: K, listener: (...args: T[K] extends unknown[] ? T[K] : never) => void): EventEmitter;
  emit<K extends keyof T & string>(event: K, ...args: T[K] extends unknown[] ? T[K] : never): boolean;
  removeAllListeners<K extends keyof T & string>(event?: K): EventEmitter;
};

// ── Constants ──────────────────────────────────

const POLL_INTERVAL_MS = 2000;
const CAPTURE_LINES = 200;

// ── TmuxMonitor ────────────────────────────────

export class TmuxMonitor extends (EventEmitter as { new(): TypedEventEmitter<TmuxMonitorEvents> & EventEmitter }) {
  private timer: ReturnType<typeof setInterval> | null = null;
  private available = false;
  private unavailableReason: string | null = null;
  private sessions: TmuxSession[] = [];
  /** Cache of pane content keyed by "session:window.pane" to detect changes */
  private paneContentCache = new Map<string, string>();

  constructor() {
    super();
  }

  // ── Public API ────────────────────────────────

  async start(): Promise<void> {
    await this.checkAvailability();

    if (!this.available) {
      console.log(`[dashboard] tmux monitor: not available (${this.unavailableReason})`);
      return;
    }

    console.log("[dashboard] tmux monitor started");
    await this.poll();
    this.timer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.paneContentCache.clear();
    console.log("[dashboard] tmux monitor stopped");
  }

  isAvailable(): { available: boolean; reason?: string } {
    return this.available
      ? { available: true }
      : { available: false, reason: this.unavailableReason ?? "unknown" };
  }

  getSessions(): TmuxSession[] {
    return this.sessions;
  }

  async getPaneContent(sessionName: string, windowIndex: number, paneIndex: number): Promise<string> {
    if (!this.available) return "";
    try {
      const target = `${sessionName}:${windowIndex}.${paneIndex}`;
      const { stdout } = await execFileAsync("tmux", [
        "capture-pane", "-p", "-t", target, "-S", `-${CAPTURE_LINES}`,
      ], { timeout: 5000 });
      return stdout;
    } catch {
      return "";
    }
  }

  // ── Internals ─────────────────────────────────

  private async checkAvailability(): Promise<void> {
    try {
      await execFileAsync("which", ["tmux"], { timeout: 3000 });
    } catch {
      this.available = false;
      this.unavailableReason = "tmux binary not found";
      return;
    }

    try {
      await execFileAsync("tmux", ["list-sessions"], { timeout: 3000 });
      this.available = true;
      this.unavailableReason = null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("no server running") || msg.includes("no sessions")) {
        // tmux is available but no sessions running — that's fine
        this.available = true;
        this.unavailableReason = null;
      } else {
        this.available = false;
        this.unavailableReason = `tmux error: ${msg}`;
      }
    }
  }

  private async poll(): Promise<void> {
    try {
      const sessions = await this.listSessions();
      const prevNames = new Set(this.sessions.map((s) => s.sessionName));
      const currNames = new Set(sessions.map((s) => s.sessionName));

      this.sessions = sessions;

      // Emit sessions update if the list changed
      const changed =
        prevNames.size !== currNames.size ||
        [...prevNames].some((n) => !currNames.has(n));

      if (changed) {
        this.emit("tmux:sessions", sessions);
      }

      // Capture pane content for Claude-related sessions
      for (const session of sessions) {
        for (const pane of session.panes) {
          await this.capturePaneIfChanged(pane);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[dashboard] tmux monitor poll error: ${msg}`);
    }
  }

  private async listSessions(): Promise<TmuxSession[]> {
    let stdout: string;
    try {
      const result = await execFileAsync("tmux", [
        "list-sessions", "-F",
        "#{session_name}\t#{session_windows}\t#{session_created}\t#{session_attached}",
      ], { timeout: 5000 });
      stdout = result.stdout;
    } catch {
      return [];
    }

    const sessions: TmuxSession[] = [];

    for (const line of stdout.trim().split("\n")) {
      if (!line) continue;
      const [name] = line.split("\t");
      if (!name) continue;

      const panes = await this.listPanes(name);

      sessions.push({
        sessionName: name,
        panes,
      });
    }

    return sessions;
  }

  private async listPanes(sessionName: string): Promise<TmuxPane[]> {
    try {
      const { stdout } = await execFileAsync("tmux", [
        "list-panes", "-s", "-t", sessionName, "-F",
        "#{window_index}\t#{pane_index}\t#{pane_active}\t#{pane_title}",
      ], { timeout: 5000 });

      return stdout.trim().split("\n").filter(Boolean).map((line) => {
        const [windowIdx, paneIdx, active, title] = line.split("\t");
        const wi = parseInt(windowIdx ?? "0", 10);
        const pi = parseInt(paneIdx ?? "0", 10);
        return {
          paneId: `${sessionName}:${wi}.${pi}`,
          sessionName,
          windowIndex: wi,
          paneIndex: pi,
          content: "",
          title: title ?? "",
          active: active === "1",
        };
      });
    } catch {
      return [];
    }
  }

  private async capturePaneIfChanged(pane: TmuxPane): Promise<void> {
    const key = `${pane.sessionName}:${pane.windowIndex}.${pane.paneIndex}`;
    try {
      const { stdout } = await execFileAsync("tmux", [
        "capture-pane", "-p", "-t", key, "-S", `-${CAPTURE_LINES}`,
      ], { timeout: 5000 });

      const prev = this.paneContentCache.get(key);
      if (prev !== stdout) {
        this.paneContentCache.set(key, stdout);
        pane.content = stdout;
        this.emit("tmux:update", pane);
      }
    } catch {
      // Pane may have disappeared — remove from cache
      this.paneContentCache.delete(key);
    }
  }
}
