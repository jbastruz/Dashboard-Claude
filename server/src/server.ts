import http from "node:http";
import express from "express";
import type { Store } from "./store/Store.js";
import type { SessionManager } from "./services/SessionManager.js";
import type { ConversationStore } from "./services/ConversationStore.js";
import type { TmuxMonitor } from "./services/TmuxMonitor.js";
import { createHookReceiver } from "./hooks/hookReceiver.js";
import { createApiRouter } from "./routes/api.js";
import { config } from "./config.js";

/**
 * Create and configure the Express app + HTTP server.
 * Does NOT call listen() — the caller is responsible for that.
 */
export function createServer(
  store: Store,
  sessionManager: SessionManager,
  conversationStore: ConversationStore,
  tmuxMonitor?: TmuxMonitor,
): {
  app: express.Express;
  server: http.Server;
} {
  const app = express();

  // ── Middleware ──────────────────────────────

  // Parse JSON bodies (hook payloads can be large-ish)
  app.use(express.json({ limit: "2mb" }));

  // CORS headers — restricted to configured origin (default: localhost:5173)
  app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", config.corsOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (_req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // ── Routes ─────────────────────────────────

  app.use("/hooks", createHookReceiver(store));
  app.use("/api", createApiRouter(store, sessionManager, conversationStore, tmuxMonitor));

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  // ── HTTP server ────────────────────────────

  const server = http.createServer(app);

  return { app, server };
}
