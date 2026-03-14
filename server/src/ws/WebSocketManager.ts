import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { Store } from "../store/Store.js";
import type { SessionManager } from "../services/SessionManager.js";
import type { ConversationStore } from "../services/ConversationStore.js";
import type { WsEvent } from "./events.js";
import type { WsClientEvent } from "./clientEvents.js";

export class WebSocketManager {
  private wss: WebSocketServer;
  private store: Store;
  private sessionManager: SessionManager;
  private conversationStore: ConversationStore;

  constructor(store: Store, sessionManager: SessionManager, conversationStore: ConversationStore) {
    this.store = store;
    this.sessionManager = sessionManager;
    this.conversationStore = conversationStore;
    this.wss = new WebSocketServer({ noServer: true });

    this.wss.on("connection", (ws: WebSocket) => {
      console.log("[dashboard] ws client connected");

      // Send full state snapshot on connect
      const snapshot: WsEvent = {
        type: "snapshot",
        data: this.store.getFullState(),
      };
      this.send(ws, snapshot);

      ws.on("message", (raw) => {
        this.handleClientMessage(ws, raw);
      });

      ws.on("close", () => {
        console.log("[dashboard] ws client disconnected");
      });

      ws.on("error", (err) => {
        console.log(`[dashboard] ws client error: ${err.message}`);
      });
    });

    // Forward store events to all connected clients
    this.bindStoreEvents();
    this.bindSessionManagerEvents();
    this.bindConversationStoreEvents();
  }

  /**
   * Handle incoming client messages (commands).
   */
  private handleClientMessage(ws: WebSocket, raw: WebSocket.RawData): void {
    let event: WsClientEvent;
    try {
      event = JSON.parse(raw.toString()) as WsClientEvent;
    } catch {
      this.send(ws, {
        type: "command:error",
        data: { requestId: "unknown", error: "Invalid JSON" },
      });
      return;
    }

    try {
      switch (event.type) {
        case "command:start-session": {
          const sessionId = this.sessionManager.startSession({
            cwd: event.data.cwd,
            prompt: event.data.prompt,
            model: event.data.model,
          });
          this.send(ws, {
            type: "command:ack",
            data: { requestId: event.requestId, sessionId },
          });
          break;
        }
        case "command:send-message": {
          this.sessionManager.sendMessage(event.data.sessionId, event.data.message);
          this.send(ws, {
            type: "command:ack",
            data: { requestId: event.requestId },
          });
          break;
        }
        case "command:stop-session": {
          this.sessionManager.stopSession(event.data.sessionId).then(() => {
            this.send(ws, {
              type: "command:ack",
              data: { requestId: event.requestId },
            });
          }).catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            this.send(ws, {
              type: "command:error",
              data: { requestId: event.requestId, error: msg },
            });
          });
          break;
        }
        case "command:resume-session": {
          const resumedId = this.sessionManager.startSession({
            cwd: event.data.cwd ?? process.cwd(),
            resumeSessionId: event.data.sessionId,
          });
          this.send(ws, {
            type: "command:ack",
            data: { requestId: event.requestId, sessionId: resumedId },
          });
          break;
        }
        default: {
          this.send(ws, {
            type: "command:error",
            data: { requestId: (event as { requestId?: string }).requestId ?? "unknown", error: "Unknown command type" },
          });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.send(ws, {
        type: "command:error",
        data: { requestId: event.requestId, error: msg },
      });
    }
  }

  /**
   * Handle HTTP upgrade requests on the "/ws" path.
   */
  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
    if (url.pathname !== "/ws") {
      socket.destroy();
      return;
    }

    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.wss.emit("connection", ws, request);
    });
  }

  /**
   * Send a typed event to a single client.
   */
  private send(ws: WebSocket, event: WsEvent): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }

  /**
   * Broadcast a typed event to every connected client.
   */
  broadcast(event: WsEvent): void {
    const payload = JSON.stringify(event);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  /**
   * Wire up store EventEmitter events to WS broadcasts.
   */
  private bindStoreEvents(): void {
    this.store.on("session:start", (session) => {
      this.broadcast({ type: "session:start", data: session });
    });

    this.store.on("session:end", (data) => {
      this.broadcast({ type: "session:end", data });
    });

    this.store.on("agent:start", (agent) => {
      this.broadcast({ type: "agent:start", data: agent });
    });

    this.store.on("agent:update", (data) => {
      this.broadcast({ type: "agent:update", data });
    });

    this.store.on("agent:stop", (data) => {
      this.broadcast({ type: "agent:stop", data });
    });

    this.store.on("task:update", (task) => {
      this.broadcast({ type: "task:update", data: task });
    });

    this.store.on("team:update", (team) => {
      this.broadcast({ type: "team:update", data: team });
    });

    this.store.on("interaction:new", (interaction) => {
      this.broadcast({ type: "interaction:new", data: interaction });
    });

    this.store.on("tool:use", (data) => {
      this.broadcast({ type: "tool:use", data });
    });
  }

  /**
   * Wire up SessionManager events to WS broadcasts.
   */
  private bindSessionManagerEvents(): void {
    this.sessionManager.on("output", (data: { sessionId: string; chunk: unknown }) => {
      this.broadcast({ type: "session:output", data });
    });
  }

  /**
   * Wire up ConversationStore events to WS broadcasts.
   */
  private bindConversationStoreEvents(): void {
    this.conversationStore.on("conversation:update", (data: { targetId: string; entries: import("../services/ConversationStore.js").ConversationEntry[] }) => {
      this.broadcast({ type: "conversation:update", data });
    });
  }

  /**
   * Close the WebSocket server and all connections.
   */
  close(): void {
    for (const client of this.wss.clients) {
      client.close();
    }
    this.wss.close();
    console.log("[dashboard] ws server closed");
  }
}
