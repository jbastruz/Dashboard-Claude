import chokidar, { type FSWatcher } from "chokidar";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { Store, TeamMember } from "../store/Store.js";
import type { ConversationStore, ConversationEntry } from "../services/ConversationStore.js";
import { toAgentType } from "../utils/agentTypes.js";
import { JsonlParser } from "../parsers/JsonlParser.js";
import { extractInteractions } from "../parsers/InteractionExtractor.js";
import { config } from "../config.js";
import { debounceFile } from "../utils/debounce.js";

/**
 * Encode a cwd path to the format used by Claude for project directories.
 * e.g. "/home/jbastruz/Dashboard-Claude" → "-home-jbastruz-Dashboard-Claude"
 */
function encodeCwd(cwd: string): string {
  return cwd.replace(/\//g, "-");
}

export class TeamWatcher {
  private watcher: FSWatcher | null = null;
  private jsonlWatcher: FSWatcher | null = null;
  private store: Store;
  private conversationStore: ConversationStore | null = null;
  private jsonlParser = new JsonlParser();
  /** Maps JSONL file path → { agentId, teamName } (once identified) */
  private jsonlToAgent = new Map<string, { agentId: string; teamName: string }>();
  /** Set of project dirs already being watched for JSONL files */
  private watchedProjectDirs = new Set<string>();
  /** Tracks emitted spawn interaction IDs to avoid duplicates on re-parse */
  private emittedSpawnIds = new Set<string>();
  private debouncedHandleFile = debounceFile(
    (fp: string) => this.handleFile(fp),
    config.watcherDebounce,
  );
  private debouncedHandleJsonl = debounceFile(
    (fp: string) => this.handleJsonl(fp),
    config.watcherDebounce,
  );

  constructor(store: Store, conversationStore?: ConversationStore) {
    this.store = store;
    this.conversationStore = conversationStore ?? null;
  }

  async start(): Promise<void> {
    await fs.mkdir(config.teamsDir, { recursive: true }).catch(() => {});

    this.watcher = chokidar.watch(config.teamsDir, {
      ignoreInitial: false,
    });

    this.watcher.on("add", (fp) => {
      if (path.basename(fp) === "config.json") this.debouncedHandleFile(fp);
    });
    this.watcher.on("change", (fp) => {
      if (path.basename(fp) === "config.json") this.debouncedHandleFile(fp);
    });

    this.watcher.on("error", (err) => {
      console.log(`[dashboard] team watcher error: ${err instanceof Error ? err.message : err}`);
    });

    console.log("[dashboard] team watcher started");
  }

  private async handleFile(filePath: string): Promise<void> {
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(raw) as Record<string, unknown>;

      const teamName =
        (data.team_name as string) ??
        (data.teamName as string) ??
        (data.name as string) ??
        path.basename(path.dirname(filePath));

      const rawMembers = (data.members as unknown[]) ?? [];
      const members: TeamMember[] = rawMembers
        .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
        .map((m) => ({
          name: (m.name as string) ?? "",
          agentId: (m.agent_id as string) ?? (m.agentId as string) ?? "",
          agentType: toAgentType(m.agent_type ?? m.agentType),
        }));

      const leadSessionId = (data.leadSessionId as string) ?? (data.lead_session_id as string) ?? "";
      this.store.upsertTeam({ teamName, leadSessionId, members });

      // Create/update Agent entries for each team member
      const cwdSet = new Set<string>();
      for (const m of rawMembers.filter(
        (x): x is Record<string, unknown> => !!x && typeof x === "object",
      )) {
        const agentId = (m.agentId as string) ?? (m.agent_id as string) ?? "";
        if (!agentId) continue;

        const now = new Date().toISOString();
        const joinedAt = typeof m.joinedAt === "number"
          ? new Date(m.joinedAt as number).toISOString()
          : typeof m.joinedAt === "string"
            ? (m.joinedAt as string)
            : now;

        this.store.upsertAgent({
          agentId,
          sessionId: leadSessionId,
          name: (m.name as string) ?? "",
          type: toAgentType(m.agentType ?? m.agent_type),
          status: m.isActive === false ? "idle" : "active",
          description: (m.description as string) ?? "",
          parentAgentId: null,
          teamName,
          startedAt: joinedAt,
          endedAt: null,
          toolsUsed: [],
          lastActivity: now,
          lastAction: null,
        });

        // Collect unique cwds to scan for JSONL files
        if (m.cwd && typeof m.cwd === "string") {
          cwdSet.add(m.cwd as string);
        }
      }

      // Generate spawn interactions: lead → each member (deterministic IDs to avoid duplicates)
      const leadAgentId = (data.leadAgentId as string) ?? (data.lead_agent_id as string) ?? "";
      if (leadAgentId) {
        for (const member of members) {
          if (!member.agentId || member.agentId === leadAgentId) continue;

          const spawnId = `team-spawn-${teamName}-${member.agentId}`;
          if (this.emittedSpawnIds.has(spawnId)) continue;
          this.emittedSpawnIds.add(spawnId);

          this.store.addInteraction({
            id: spawnId,
            type: "spawn",
            fromAgentId: leadAgentId,
            toAgentId: member.agentId,
            label: `team: ${member.name}`,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Scan project directories for team member JSONL files
      for (const cwd of cwdSet) {
        await this.scanProjectDirForTeamJsonl(cwd, teamName);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[dashboard] team watcher: error parsing ${filePath}: ${msg}`);
    }
  }

  /**
   * Scan a project directory for session-level JSONL files that belong to team members.
   * Identifies them by reading the first line which contains teamName and agentName.
   */
  private async scanProjectDirForTeamJsonl(cwd: string, teamName: string): Promise<void> {
    const encoded = encodeCwd(cwd);
    const projectDir = path.join(config.projectsDir, encoded);

    try {
      const entries = await fs.readdir(projectDir);
      for (const entry of entries) {
        if (!entry.endsWith(".jsonl")) continue;
        const fullPath = path.join(projectDir, entry);
        await this.identifyAndProcessJsonl(fullPath, teamName);
      }
    } catch {
      // Directory may not exist yet
    }

    // Start watching this project dir for new/changed JSONL files
    if (!this.watchedProjectDirs.has(projectDir)) {
      this.watchedProjectDirs.add(projectDir);
      await this.watchProjectDir(projectDir, teamName);
    }
  }

  /**
   * Watch a project directory for JSONL file changes (real-time updates).
   */
  private async watchProjectDir(projectDir: string, teamName: string): Promise<void> {
    if (!this.jsonlWatcher) {
      this.jsonlWatcher = chokidar.watch([], { ignoreInitial: true });
      this.jsonlWatcher.on("add", (fp) => {
        if (fp.endsWith(".jsonl") && !fp.includes("/subagents/")) {
          this.debouncedHandleJsonl(fp);
        }
      });
      this.jsonlWatcher.on("change", (fp) => {
        if (fp.endsWith(".jsonl") && !fp.includes("/subagents/")) {
          this.debouncedHandleJsonl(fp);
        }
      });
      this.jsonlWatcher.on("error", (err) => {
        console.log(`[dashboard] team jsonl watcher error: ${err instanceof Error ? err.message : err}`);
      });
    }
    this.jsonlWatcher.add(projectDir);

    // Store teamName for identification of new files
    // We'll identify them when handleJsonl is called
  }

  /**
   * Read the first line of a JSONL file to identify if it belongs to a team member.
   * If yes, map it and process the conversation entries.
   */
  private async identifyAndProcessJsonl(filePath: string, _teamName: string): Promise<void> {
    // Already identified
    if (this.jsonlToAgent.has(filePath)) {
      const info = this.jsonlToAgent.get(filePath)!;
      await this.processJsonlForAgent(filePath, info.agentId, info.teamName);
      return;
    }

    try {
      const fd = await fs.open(filePath, "r");
      try {
        const buf = Buffer.alloc(4096);
        const { bytesRead } = await fd.read(buf, 0, 4096, 0);
        if (bytesRead === 0) return;

        const firstLine = buf.toString("utf-8", 0, bytesRead).split("\n")[0].trim();
        if (!firstLine) return;

        const data = JSON.parse(firstLine) as Record<string, unknown>;
        const entryTeamName = data.teamName as string | undefined;
        const agentName = data.agentName as string | undefined;

        if (!entryTeamName || !agentName) return;

        // Build agentId from agentName and teamName (format: "name@team")
        const agentId = `${agentName}@${entryTeamName}`;
        this.jsonlToAgent.set(filePath, { agentId, teamName: entryTeamName });
        console.log(`[dashboard] team watcher: mapped ${path.basename(filePath)} → ${agentId}`);

        await this.processJsonlForAgent(filePath, agentId, entryTeamName);
      } finally {
        await fd.close();
      }
    } catch {
      // File may not be readable yet
    }
  }

  /**
   * Process a JSONL file: feed conversation entries to ConversationStore
   * and extract interactions for the graph.
   */
  private async processJsonlForAgent(filePath: string, agentId: string, teamName: string): Promise<void> {
    const entries = await this.jsonlParser.parse(filePath);
    if (entries.length === 0) return;

    const recordEntries = entries.filter(
      (e): e is Record<string, unknown> => typeof e === "object" && e !== null,
    );

    // Feed conversation entries
    if (this.conversationStore) {
      const conversationEntries = this.extractConversationEntries(recordEntries);
      if (conversationEntries.length > 0) {
        this.conversationStore.appendEntries(agentId, conversationEntries);
      }
    }

    // Extract and emit interactions (SendMessage → message edges)
    const interactions = extractInteractions(entries, agentId, teamName);
    for (const interaction of interactions) {
      this.store.addInteraction(interaction);
    }
  }

  /**
   * Handle a JSONL file event (add/change) from the project dir watcher.
   */
  private async handleJsonl(filePath: string): Promise<void> {
    // Skip subagent files (handled by SubagentWatcher)
    if (filePath.includes("/subagents/")) return;

    const info = this.jsonlToAgent.get(filePath);
    if (info) {
      await this.processJsonlForAgent(filePath, info.agentId, info.teamName);
    } else {
      // Try to identify — scan all known teams for a match
      const teams = this.store.getFullState().teams;
      for (const team of teams) {
        await this.identifyAndProcessJsonl(filePath, team.teamName);
        if (this.jsonlToAgent.has(filePath)) break;
      }
    }
  }

  // ── Conversation extraction (mirrors SubagentWatcher logic) ──

  private extractTextContent(value: unknown): string {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return "";

    const obj = value as Record<string, unknown>;
    if ("content" in obj) {
      return this.extractTextContent(obj.content);
    }

    if (Array.isArray(value)) {
      return value
        .filter((b): b is Record<string, unknown> =>
          typeof b === "object" && b !== null && (b as Record<string, unknown>).type === "text",
        )
        .map((b) => (b.text as string) ?? "")
        .join("\n");
    }

    return JSON.stringify(value);
  }

  private extractContentBlocks(entry: Record<string, unknown>): unknown[] {
    if (Array.isArray(entry.content_blocks)) return entry.content_blocks;

    const message = entry.message;
    if (message && typeof message === "object" && !Array.isArray(message)) {
      const content = (message as Record<string, unknown>).content;
      if (Array.isArray(content)) return content;
    }

    return [];
  }

  private extractConversationEntries(entries: Record<string, unknown>[]): ConversationEntry[] {
    const result: ConversationEntry[] = [];

    for (const entry of entries) {
      const entryType = entry.type as string | undefined;
      const timestamp = (entry.timestamp as string) ?? new Date().toISOString();

      if (entryType === "user" || entryType === "human") {
        const text = this.extractTextContent(entry.message) || this.extractTextContent(entry.content);
        if (text) {
          result.push({
            id: crypto.randomUUID(),
            role: "user",
            content: text,
            timestamp,
          });
        }
      } else if (entryType === "assistant") {
        const text = this.extractTextContent(entry.message) || this.extractTextContent(entry.content);
        if (text) {
          result.push({
            id: crypto.randomUUID(),
            role: "assistant",
            content: text,
            timestamp,
          });
        }

        const contentBlocks = this.extractContentBlocks(entry);
        for (const block of contentBlocks) {
          const b = block as Record<string, unknown>;
          if (b.type === "tool_use") {
            result.push({
              id: crypto.randomUUID(),
              role: "tool_call",
              content: (b.name as string) ?? "unknown_tool",
              timestamp,
              toolName: b.name as string,
              toolInput: typeof b.input === "string" ? b.input : JSON.stringify(b.input ?? {}),
            });
          } else if (b.type === "thinking") {
            result.push({
              id: crypto.randomUUID(),
              role: "thinking",
              content: (b.thinking as string) ?? (b.text as string) ?? "",
              timestamp,
            });
          }
        }
      } else if (entryType === "tool_result") {
        result.push({
          id: crypto.randomUUID(),
          role: "tool_result",
          content: typeof entry.content === "string"
            ? entry.content
            : JSON.stringify(entry.content ?? ""),
          timestamp,
          toolName: entry.tool_use_id as string | undefined,
        });
      }
    }

    return result;
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    if (this.jsonlWatcher) {
      await this.jsonlWatcher.close();
      this.jsonlWatcher = null;
    }
    this.jsonlParser.resetAll();
    this.jsonlToAgent.clear();
    this.watchedProjectDirs.clear();
    console.log("[dashboard] team watcher stopped");
  }
}
