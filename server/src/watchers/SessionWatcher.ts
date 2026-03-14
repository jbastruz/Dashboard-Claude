import chokidar, { type FSWatcher } from "chokidar";
import fs from "node:fs/promises";
import path from "node:path";
import type { Store } from "../store/Store.js";
import { config } from "../config.js";

export class SessionWatcher {
  private watcher: FSWatcher | null = null;
  private store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  async start(): Promise<void> {
    await fs.mkdir(config.sessionsDir, { recursive: true }).catch(() => {});

    this.watcher = chokidar.watch(config.sessionsDir, {
      ignoreInitial: false,
      depth: 0,
    });

    this.watcher.on("add", (filePath) => {
      if (filePath.endsWith(".json")) this.handleFile(filePath);
    });
    this.watcher.on("change", (filePath) => {
      if (filePath.endsWith(".json")) this.handleFile(filePath);
    });
    this.watcher.on("unlink", (filePath) => {
      if (filePath.endsWith(".json")) this.handleRemove(filePath);
    });

    this.watcher.on("error", (err) => {
      console.log(`[dashboard] session watcher error: ${err instanceof Error ? err.message : err}`);
    });

    console.log("[dashboard] session watcher started");
  }

  private async handleFile(filePath: string): Promise<void> {
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(raw) as Record<string, unknown>;

      const sessionId =
        (data.session_id as string) ??
        (data.sessionId as string) ??
        path.basename(filePath, ".json");

      // startedAt may be epoch ms (number) or ISO string
      let startedAt: string;
      const rawStarted = data.started_at ?? data.startedAt;
      if (typeof rawStarted === "number") {
        startedAt = new Date(rawStarted).toISOString();
      } else if (typeof rawStarted === "string") {
        startedAt = rawStarted;
      } else {
        startedAt = new Date().toISOString();
      }

      this.store.upsertSession({
        sessionId,
        pid: (data.pid as number) ?? (data.session_pid as number) ?? 0,
        cwd: (data.cwd as string) ?? (data.session_cwd as string) ?? "",
        startedAt,
        status: (data.status as "active" | "ended") ?? "active",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[dashboard] session watcher: error parsing ${filePath}: ${msg}`);
    }
  }

  private handleRemove(filePath: string): void {
    const sessionId = path.basename(filePath, ".json");
    this.store.removeSession(sessionId);
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      console.log("[dashboard] session watcher stopped");
    }
  }
}
