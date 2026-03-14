import type { WsEvent } from "../types/ws-events";
import type { WsClientEvent } from "../types/chat";
import { WS_URL, WS_RECONNECT_BASE_MS, WS_RECONNECT_MAX_MS } from "../lib/constants";

export type WsStatus = "connected" | "connecting" | "disconnected" | "reconnecting";

export class WsClient {
  private ws: WebSocket | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  onMessage: ((event: WsEvent) => void) | null = null;
  onStatusChange: ((status: WsStatus) => void) | null = null;

  connect(): void {
    if (this.disposed) return;

    this.setStatus(this.reconnectAttempt === 0 ? "connecting" : "reconnecting");

    try {
      this.ws = new WebSocket(WS_URL);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.setStatus("connected");
    };

    this.ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as WsEvent;
        this.onMessage?.(parsed);
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      if (!this.disposed) {
        this.setStatus("disconnected");
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  send(event: WsClientEvent): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  disconnect(): void {
    this.disposed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }
    this.setStatus("disconnected");
  }

  private scheduleReconnect(): void {
    if (this.disposed) return;

    const delay = Math.min(
      WS_RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempt),
      WS_RECONNECT_MAX_MS,
    );
    this.reconnectAttempt++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private setStatus(status: WsStatus): void {
    this.onStatusChange?.(status);
  }
}
