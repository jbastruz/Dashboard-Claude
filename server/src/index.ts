import { config } from "./config.js";
import { Store } from "./store/Store.js";
import { createServer } from "./server.js";
import { WebSocketManager } from "./ws/WebSocketManager.js";
import { WatcherManager } from "./watchers/WatcherManager.js";
import { PidChecker } from "./services/PidChecker.js";
import { SessionManager } from "./services/SessionManager.js";
import { ConversationStore, type ConversationEntry } from "./services/ConversationStore.js";
import { TmuxMonitor } from "./services/TmuxMonitor.js";
import { installHooks, uninstallHooks } from "./hooks/hookInstaller.js";

async function main(): Promise<void> {
  // ── Initialize core components ──────────────

  const store = new Store();
  const sessionManager = new SessionManager();
  const conversationStore = new ConversationStore();
  const tmuxMonitor = new TmuxMonitor();
  const { server } = createServer(store, sessionManager, conversationStore, tmuxMonitor);
  const wsManager = new WebSocketManager(store, sessionManager, conversationStore, tmuxMonitor);
  const watcherManager = new WatcherManager(store, conversationStore);
  const pidChecker = new PidChecker(store);

  // ── Connect SessionManager events ───────────

  sessionManager.on("output", (data: { sessionId: string; chunk: unknown }) => {
    const chunk = data.chunk as Record<string, unknown>;
    const chunkType = chunk?.type as string | undefined;

    if (chunkType === "content_block_delta" || chunkType === "result") {
      // Extract text content from stream-json chunks
      let content = "";
      let role: ConversationEntry["role"] = "assistant";

      if (chunkType === "content_block_delta") {
        const delta = chunk.delta as Record<string, unknown> | undefined;
        content = (delta?.text as string) ?? "";
      } else if (chunkType === "result") {
        content = (chunk.result as string) ?? (chunk.text as string) ?? "";
      }

      if (content) {
        conversationStore.appendEntry(data.sessionId, {
          id: "",
          role,
          content,
          timestamp: new Date().toISOString(),
          isStreaming: chunkType === "content_block_delta",
        });
      }
    }
  });

  sessionManager.on("exit", (data: { sessionId: string; code: number | null }) => {
    store.removeSession(data.sessionId);
  });

  // ── WebSocket upgrade handling ──────────────

  server.on("upgrade", (request, socket, head) => {
    wsManager.handleUpgrade(request, socket, head);
  });

  // ── Install hooks into Claude settings ──────

  try {
    await installHooks();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[dashboard] warning: could not install hooks: ${msg}`);
  }

  // ── Start watchers + PID checker + tmux ─────

  await watcherManager.start();
  pidChecker.start();
  await tmuxMonitor.start();

  // ── Start listening ─────────────────────────

  server.listen(config.port, () => {
    console.log(`[dashboard] server listening on http://localhost:${config.port}`);
    console.log(`[dashboard] websocket available at ws://localhost:${config.port}/ws`);
  });

  // ── Graceful shutdown ───────────────────────

  const shutdown = async (signal: string) => {
    console.log(`[dashboard] received ${signal}, shutting down...`);

    pidChecker.stop();
    tmuxMonitor.stop();
    store.stopGc();

    await sessionManager.stopAll();

    await watcherManager.stop();

    try {
      await uninstallHooks();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[dashboard] warning: could not uninstall hooks: ${msg}`);
    }

    wsManager.close();

    server.close(() => {
      console.log("[dashboard] server closed");
      process.exit(0);
    });

    // Force exit if server.close hangs
    setTimeout(() => {
      console.log("[dashboard] forced exit after timeout");
      process.exit(1);
    }, 5000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[dashboard] fatal error:", err);
  process.exit(1);
});
