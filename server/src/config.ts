import { homedir } from "node:os";
import { join } from "node:path";

const home = homedir();

export const config = {
  port: parseInt(process.env.DASHBOARD_PORT ?? "3002", 10),
  claudeDir: join(home, ".claude"),
  sessionsDir: join(home, ".claude", "sessions"),
  projectsDir: join(home, ".claude", "projects"),
  tasksDir: join(home, ".claude", "tasks"),
  teamsDir: join(home, ".claude", "teams"),
  settingsPath: join(home, ".claude", "settings.json"),
  pidCheckInterval: 5000,
  watcherDebounce: 300,
  claudeBinary: process.env.CLAUDE_BINARY ?? "claude",
  defaultModel: process.env.CLAUDE_MODEL ?? "sonnet",
  sessionStopTimeout: 5000,
  maxManagedSessions: 10,
  maxInteractions: 5000,
  maxConversationEntries: 500,
  gcIntervalMs: 60_000,
  gcMaxAgeMs: 3_600_000,
  corsOrigin: process.env.DASHBOARD_CORS_ORIGIN ?? "http://localhost:5173",
};
