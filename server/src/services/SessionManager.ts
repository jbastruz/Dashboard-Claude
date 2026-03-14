import { EventEmitter } from "node:events";
import { spawn, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import { config } from "../config.js";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ManagedSession {
  sessionId: string;
  process: ChildProcess;
  cwd: string;
  stdoutBuffer: string;
  startedAt: string;
}

export interface StartSessionOptions {
  cwd: string;
  prompt?: string;
  model?: string;
  resumeSessionId?: string;
}

export interface SessionManagerEvents {
  output: [data: { sessionId: string; chunk: unknown }];
  message: [data: { sessionId: string; message: unknown }];
  error: [data: { sessionId: string; error: string }];
  exit: [data: { sessionId: string; code: number | null }];
}

// ──────────────────────────────────────────────
// SessionManager
// ──────────────────────────────────────────────

export class SessionManager extends EventEmitter {
  private sessions = new Map<string, ManagedSession>();

  /**
   * Start a new managed Claude session.
   */
  startSession(options: StartSessionOptions): string {
    if (this.sessions.size >= config.maxManagedSessions) {
      throw new Error(`Maximum managed sessions (${config.maxManagedSessions}) reached`);
    }

    const sessionId = options.resumeSessionId ?? crypto.randomUUID();
    const model = options.model ?? config.defaultModel;

    const args = [
      "-p",
      "--output-format", "stream-json",
      "--input-format", "stream-json",
      "--permission-mode", "bypassPermissions",
      "--model", model,
      "--session-id", sessionId,
    ];

    if (options.resumeSessionId) {
      args.push("--resume", options.resumeSessionId);
    }

    const child = spawn(config.claudeBinary, args, {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    const managed: ManagedSession = {
      sessionId,
      process: child,
      cwd: options.cwd,
      stdoutBuffer: "",
      startedAt: new Date().toISOString(),
    };

    this.sessions.set(sessionId, managed);

    // Parse stdout line by line (stream-json outputs one JSON per line)
    child.stdout?.on("data", (data: Buffer) => {
      managed.stdoutBuffer += data.toString();
      const lines = managed.stdoutBuffer.split("\n");
      // Keep the last incomplete line in the buffer
      managed.stdoutBuffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed: unknown = JSON.parse(trimmed);
          this.emit("output", { sessionId, chunk: parsed });
          this.emit("message", { sessionId, message: parsed });
        } catch {
          // Not valid JSON, ignore
        }
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      const text = data.toString().trim();
      if (text) {
        this.emit("error", { sessionId, error: text });
      }
    });

    child.on("exit", (code) => {
      this.sessions.delete(sessionId);
      this.emit("exit", { sessionId, code });
      console.log(`[dashboard] managed session ${sessionId} exited with code ${code}`);
    });

    child.on("error", (err) => {
      this.emit("error", { sessionId, error: err.message });
    });

    // Write the initial prompt if provided
    if (options.prompt) {
      const msg = JSON.stringify({ type: "user", message: options.prompt });
      child.stdin?.write(msg + "\n");
    }

    console.log(`[dashboard] managed session ${sessionId} started (cwd: ${options.cwd})`);
    return sessionId;
  }

  /**
   * Send a message to a managed session's stdin.
   */
  sendMessage(sessionId: string, message: string): void {
    const managed = this.sessions.get(sessionId);
    if (!managed) {
      throw new Error(`Session ${sessionId} not found or not managed`);
    }
    if (!managed.process.stdin?.writable) {
      throw new Error(`Session ${sessionId} stdin is not writable`);
    }

    const msg = JSON.stringify({ type: "user", message });
    managed.process.stdin.write(msg + "\n");
  }

  /**
   * Stop a managed session. Sends SIGTERM first, then SIGKILL after timeout.
   */
  async stopSession(sessionId: string): Promise<void> {
    const managed = this.sessions.get(sessionId);
    if (!managed) {
      throw new Error(`Session ${sessionId} not found or not managed`);
    }

    return new Promise<void>((resolve) => {
      const child = managed.process;

      const killTimer = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          // Already dead
        }
      }, config.sessionStopTimeout);

      child.once("exit", () => {
        clearTimeout(killTimer);
        resolve();
      });

      try {
        child.kill("SIGTERM");
      } catch {
        // Already dead
        clearTimeout(killTimer);
        this.sessions.delete(sessionId);
        resolve();
      }
    });
  }

  /**
   * Stop all managed sessions.
   */
  async stopAll(): Promise<void> {
    const ids = [...this.sessions.keys()];
    if (ids.length === 0) return;
    console.log(`[dashboard] stopping ${ids.length} managed session(s)...`);
    await Promise.allSettled(ids.map((id) => this.stopSession(id)));
  }

  /**
   * Check if a session is managed by this manager.
   */
  isManaged(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Get all managed session IDs.
   */
  getManagedSessionIds(): string[] {
    return [...this.sessions.keys()];
  }
}
