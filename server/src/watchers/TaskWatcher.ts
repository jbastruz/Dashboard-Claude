import chokidar, { type FSWatcher } from "chokidar";
import fs from "node:fs/promises";
import path from "node:path";
import type { Store, TaskStatus } from "../store/Store.js";
import { config } from "../config.js";
import { debounceFile } from "../utils/debounce.js";

export class TaskWatcher {
  private watcher: FSWatcher | null = null;
  private store: Store;
  private debouncedHandleFile = debounceFile(
    (fp: string) => this.handleFile(fp),
    config.watcherDebounce,
  );

  constructor(store: Store) {
    this.store = store;
  }

  async start(): Promise<void> {
    await fs.mkdir(config.tasksDir, { recursive: true }).catch(() => {});

    this.watcher = chokidar.watch(config.tasksDir, {
      ignoreInitial: false,
    });

    this.watcher.on("add", (fp) => {
      if (fp.endsWith(".json")) this.debouncedHandleFile(fp);
    });
    this.watcher.on("change", (fp) => {
      if (fp.endsWith(".json")) this.debouncedHandleFile(fp);
    });

    this.watcher.on("error", (err) => {
      console.log(`[dashboard] task watcher error: ${err instanceof Error ? err.message : err}`);
    });

    console.log("[dashboard] task watcher started");
  }

  private async handleFile(filePath: string): Promise<void> {
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(raw) as Record<string, unknown>;

      // Skip internal tasks (e.g. agent tracking tasks created by team system)
      const metadata = data.metadata as Record<string, unknown> | undefined;
      if (metadata?._internal) return;

      const taskId =
        (data.task_id as string) ??
        (data.taskId as string) ??
        path.basename(filePath, ".json");

      const status: TaskStatus =
        (data.status as TaskStatus) ?? "pending";

      // Derive teamName from path: tasks/{teamName}/xxx.json vs tasks/xxx.json
      const rel = path.relative(config.tasksDir, filePath);
      const parts = rel.split(path.sep);
      const teamName = parts.length > 1 ? parts[0] : null;

      // If sessionId is missing but we have a teamName, use the team's leadSessionId
      let sessionId = (data.session_id as string) ?? (data.sessionId as string) ?? "";
      if (!sessionId && teamName) {
        const team = this.store.getTeam(teamName);
        if (team) sessionId = team.leadSessionId;
      }

      this.store.upsertTask({
        taskId,
        sessionId,
        subject: (data.subject as string) ?? (data.title as string) ?? "",
        status,
        ownerId: (data.owner_id as string) ?? (data.ownerId as string) ?? null,
        ownerName: (data.owner_name as string) ?? (data.ownerName as string) ?? null,
        teamName,
        blocks: (data.blocks as string[]) ?? [],
        blockedBy: (data.blocked_by as string[]) ?? (data.blockedBy as string[]) ?? [],
        createdAt: (data.created_at as string) ?? (data.createdAt as string) ?? new Date().toISOString(),
        updatedAt: (data.updated_at as string) ?? (data.updatedAt as string) ?? new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[dashboard] task watcher: error parsing ${filePath}: ${msg}`);
    }
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      console.log("[dashboard] task watcher stopped");
    }
  }
}
