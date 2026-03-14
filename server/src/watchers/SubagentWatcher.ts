import chokidar, { type FSWatcher } from "chokidar";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { Store } from "../store/Store.js";
import type { ConversationStore, ConversationEntry } from "../services/ConversationStore.js";
import { toAgentType } from "../utils/agentTypes.js";
import { JsonlParser } from "../parsers/JsonlParser.js";
import { extractInteractions } from "../parsers/InteractionExtractor.js";
import { config } from "../config.js";
import { debounceFile } from "../utils/debounce.js";

export class SubagentWatcher {
  private watcher: FSWatcher | null = null;
  private store: Store;
  private conversationStore: ConversationStore | null = null;
  private jsonlParser = new JsonlParser();
  private debouncedHandleFile = debounceFile(
    (fp: string) => this.handleFile(fp),
    config.watcherDebounce,
  );

  constructor(store: Store, conversationStore?: ConversationStore) {
    this.store = store;
    this.conversationStore = conversationStore ?? null;
  }

  async start(): Promise<void> {
    await fs.mkdir(config.projectsDir, { recursive: true }).catch(() => {});

    this.watcher = chokidar.watch(config.projectsDir, {
      ignoreInitial: false,
    });

    this.watcher.on("add", (fp) => this.debouncedHandleFile(fp));
    this.watcher.on("change", (fp) => this.debouncedHandleFile(fp));
    this.watcher.on("error", (err) => {
      console.log(`[dashboard] subagent watcher error: ${err instanceof Error ? err.message : err}`);
    });

    console.log("[dashboard] subagent watcher started");
  }

  private async handleFile(filePath: string): Promise<void> {
    const basename = path.basename(filePath);

    // Only process subagent files
    if (!filePath.includes("/subagents/") && !filePath.includes("\\subagents\\")) return;

    if (basename.endsWith(".meta.json")) {
      await this.handleMeta(filePath);
    } else if (basename.endsWith(".jsonl")) {
      await this.handleJsonl(filePath);
    }
  }

  private async handleMeta(filePath: string): Promise<void> {
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(raw) as Record<string, unknown>;

      const basename = path.basename(filePath, ".meta.json");
      const agentId = (data.agent_id as string) ?? (data.agentId as string) ?? basename;

      // Derive sessionId from path: .../projects/{encoded-path}/{sessionId}/subagents/...
      const parts = filePath.split(path.sep);
      const subagentsIdx = parts.lastIndexOf("subagents");
      const derivedSessionId = subagentsIdx > 0 ? parts[subagentsIdx - 1] : "";

      this.store.upsertAgent({
        agentId,
        sessionId: (data.session_id as string) ?? (data.sessionId as string) ?? derivedSessionId,
        name: (data.name as string) ?? (data.agent_name as string) ?? basename,
        type: toAgentType(data.agentType ?? data.type ?? data.agent_type),
        status: (data.status as "active" | "idle" | "completed") ?? "active",
        description: (data.description as string) ?? "",
        parentAgentId: (data.parent_agent_id as string) ?? (data.parentAgentId as string) ?? null,
        teamName: (data.team_name as string) ?? (data.teamName as string) ?? null,
        startedAt: (data.started_at as string) ?? (data.startedAt as string) ?? new Date().toISOString(),
        endedAt: (data.ended_at as string) ?? (data.endedAt as string) ?? null,
        toolsUsed: (data.tools_used as string[]) ?? (data.toolsUsed as string[]) ?? [],
        lastActivity: (data.last_activity as string) ?? (data.lastActivity as string) ?? new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[dashboard] subagent watcher: error parsing meta ${filePath}: ${msg}`);
    }
  }

  private async handleJsonl(filePath: string): Promise<void> {
    try {
      const basename = path.basename(filePath, ".jsonl");
      const agentId = basename;

      const entries = await this.jsonlParser.parse(filePath);
      if (entries.length === 0) return;

      const interactions = extractInteractions(entries, agentId);

      for (const interaction of interactions) {
        this.store.addInteraction(interaction);
      }

      // Feed conversation entries to ConversationStore
      if (this.conversationStore) {
        const recordEntries = entries.filter(
          (e): e is Record<string, unknown> => typeof e === "object" && e !== null,
        );
        const conversationEntries = this.extractConversationEntries(recordEntries);
        if (conversationEntries.length > 0) {
          this.conversationStore.appendEntries(agentId, conversationEntries);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[dashboard] subagent watcher: error parsing jsonl ${filePath}: ${msg}`);
    }
  }

  /**
   * Extract text content from a Claude JSONL message field.
   * The `message` field can be a string, or an object like:
   *   { role: "user", content: "text" }
   *   { role: "assistant", content: [{ type: "text", text: "..." }, ...] }
   */
  private extractTextContent(value: unknown): string {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return "";

    const obj = value as Record<string, unknown>;

    // { role, content } shape — extract content recursively
    if ("content" in obj) {
      return this.extractTextContent(obj.content);
    }

    // Array of content blocks — extract text blocks
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

  /**
   * Extract content blocks (tool_use, thinking) from a message object.
   */
  private extractContentBlocks(entry: Record<string, unknown>): unknown[] {
    // Check entry.content_blocks first
    if (Array.isArray(entry.content_blocks)) return entry.content_blocks;

    // Then check message.content if it's an array
    const message = entry.message;
    if (message && typeof message === "object" && !Array.isArray(message)) {
      const content = (message as Record<string, unknown>).content;
      if (Array.isArray(content)) return content;
    }

    return [];
  }

  /**
   * Convert JSONL entries to ConversationEntry objects.
   */
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

        // Check for tool_use / thinking blocks within the message
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
    this.jsonlParser.resetAll();
    console.log("[dashboard] subagent watcher stopped");
  }
}
