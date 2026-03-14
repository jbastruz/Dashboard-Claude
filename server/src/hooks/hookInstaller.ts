import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";

/**
 * Marker used to identify hooks installed by this dashboard.
 * We embed it in the command string so we can detect and remove our hooks
 * without disturbing user-configured hooks.
 */
const HOOK_MARKER = "#dashboard-claude-hook";

const HOOK_EVENTS = [
  "SessionStart",
  "SessionEnd",
  "SubagentStart",
  "SubagentStop",
  "TeammateIdle",
  "TaskCompleted",
  "PreToolUse",
  "PostToolUse",
  "Stop",
] as const;

/**
 * Claude Code hook format (v2.1+):
 * Each event maps to an array of HookGroup objects.
 * A HookGroup has a "matcher" (tool name filter, "" = match all)
 * and a "hooks" array of HookEntry.
 */
interface HookEntry {
  type: "command";
  command: string;
}

interface HookGroup {
  matcher: string;
  hooks: HookEntry[];
}

interface ClaudeSettings {
  hooks?: Record<string, HookGroup[]>;
  [key: string]: unknown;
}

function makeCurlCommand(): string {
  return `curl -s -X POST http://localhost:${config.port}/hooks -H 'Content-Type: application/json' -d "$(cat)" ${HOOK_MARKER}`;
}

function isDashboardHookGroup(group: HookGroup): boolean {
  return group.hooks?.some((h) => h.command?.includes(HOOK_MARKER)) ?? false;
}

/**
 * Read the existing settings file, or return an empty object if it
 * doesn't exist or is malformed.
 */
async function readSettings(): Promise<ClaudeSettings> {
  try {
    const raw = await fs.readFile(config.settingsPath, "utf-8");
    return JSON.parse(raw) as ClaudeSettings;
  } catch {
    return {};
  }
}

async function writeSettings(settings: ClaudeSettings): Promise<void> {
  await fs.mkdir(path.dirname(config.settingsPath), { recursive: true });
  await fs.writeFile(
    config.settingsPath,
    JSON.stringify(settings, null, 2) + "\n",
    "utf-8",
  );
}

/**
 * Install dashboard hooks into ~/.claude/settings.json.
 * Uses the correct format: { matcher, hooks: [{ type, command }] }
 * Merges into existing hooks without overwriting user hooks.
 */
export async function installHooks(): Promise<void> {
  const settings = await readSettings();

  if (!settings.hooks) {
    settings.hooks = {};
  }

  const hookCommand = makeCurlCommand();
  const dashboardGroup: HookGroup = {
    matcher: "",
    hooks: [{ type: "command", command: hookCommand }],
  };

  for (const event of HOOK_EVENTS) {
    const existing: HookGroup[] = settings.hooks[event] ?? [];

    // Skip if we already have our hook group for this event
    if (existing.some(isDashboardHookGroup)) {
      continue;
    }

    // Append our hook group, preserving any user-defined hook groups
    settings.hooks[event] = [...existing, dashboardGroup];
  }

  await writeSettings(settings);
  console.log("[dashboard] hooks installed into ~/.claude/settings.json");
}

/**
 * Remove all dashboard hook groups from ~/.claude/settings.json.
 */
export async function uninstallHooks(): Promise<void> {
  const settings = await readSettings();

  if (!settings.hooks) {
    return;
  }

  for (const event of HOOK_EVENTS) {
    const existing: HookGroup[] = settings.hooks[event] ?? [];
    const filtered = existing.filter((group) => !isDashboardHookGroup(group));

    if (filtered.length === 0) {
      delete settings.hooks[event];
    } else {
      settings.hooks[event] = filtered;
    }
  }

  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  await writeSettings(settings);
  console.log("[dashboard] hooks uninstalled from ~/.claude/settings.json");
}
