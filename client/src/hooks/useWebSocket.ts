import { useEffect, useRef } from "react";
import { WsClient } from "../api/ws";
import { fetchState } from "../api/rest";
import { useSessionStore } from "../stores/sessionStore";
import { useAgentStore } from "../stores/agentStore";
import { useTaskStore } from "../stores/taskStore";
import { useInteractionStore } from "../stores/interactionStore";
import { useWsStore } from "../stores/wsStore";
import { useChatStore } from "../stores/chatStore";
import { useTeamStore } from "../stores/teamStore";
import { useTmuxStore } from "../stores/tmuxStore";
import type { WsEvent } from "../types/ws-events";
import { toClientMessages } from "../lib/mappers";

export function useWebSocket(): void {
  const clientRef = useRef<WsClient | null>(null);

  useEffect(() => {
    const client = new WsClient();
    clientRef.current = client;

    const sessionStore = useSessionStore.getState();
    const agentStore = useAgentStore.getState();
    const taskStore = useTaskStore.getState();
    const interactionStore = useInteractionStore.getState();
    const wsStore = useWsStore.getState();
    const chatStore = useChatStore.getState();
    const teamStore = useTeamStore.getState();
    const tmuxStore = useTmuxStore.getState();

    // Store client reference for bidirectional communication
    wsStore.setWsClient(client);

    client.onStatusChange = (status) => {
      wsStore.setStatus(status);
    };

    client.onMessage = (event: WsEvent) => {
      switch (event.type) {
        case "snapshot":
          sessionStore.setAll(event.data.sessions);
          agentStore.setAll(event.data.agents);
          taskStore.setAll(event.data.tasks);
          interactionStore.setAll(event.data.interactions);
          teamStore.setAll(event.data.teams ?? []);
          break;

        case "session:start":
          sessionStore.setSession(event.data);
          break;

        case "session:end": {
          const existing = useSessionStore.getState().sessions.find(
            (s) => s.sessionId === event.data.sessionId,
          );
          if (existing) {
            sessionStore.setSession({ ...existing, status: "ended" });
          }
          break;
        }

        case "agent:start":
          agentStore.setAgent({
            ...event.data,
            lastAction: event.data.lastAction ?? {
              type: "started",
              detail: event.data.name,
              timestamp: event.data.startedAt,
            },
          });
          break;

        case "agent:update":
          agentStore.updateAgent(event.data);
          break;

        case "agent:stop":
          agentStore.updateAgent({
            agentId: event.data.agentId,
            status: "completed",
            endedAt: new Date().toISOString(),
            lastAction: {
              type: "completed",
              detail: "",
              timestamp: new Date().toISOString(),
            },
          });
          break;

        case "task:update":
          taskStore.setTask(event.data);
          break;

        case "interaction:new":
          interactionStore.addInteraction(event.data);
          break;

        case "tool:use": {
          const current = useAgentStore.getState().agents.find(
            (a) => a.agentId === event.data.agentId,
          );
          if (current) {
            const tools = current.toolsUsed.includes(event.data.toolName)
              ? current.toolsUsed
              : [...current.toolsUsed, event.data.toolName];
            agentStore.updateAgent({
              agentId: event.data.agentId,
              toolsUsed: tools,
              lastActivity: event.data.timestamp,
              lastAction: {
                type: "tool",
                detail: event.data.toolName,
                timestamp: event.data.timestamp,
              },
            });
          }
          break;
        }

        case "team:update":
          teamStore.setTeam(event.data);
          break;

        case "conversation:update": {
          const { targetId, entries } = event.data;
          chatStore.setMessages(targetId, toClientMessages(targetId, entries));
          break;
        }

        case "session:output": {
          // Server sends { sessionId, chunk: unknown }
          // chunk structure is opaque — log for now until streaming protocol is finalized
          console.debug("[ws] session:output", event.data.sessionId, event.data.chunk);
          break;
        }

        case "tmux:sessions":
          tmuxStore.setSessions(event.data.available, event.data.sessions);
          break;

        case "tmux:update":
          tmuxStore.updatePane(event.data);
          break;

        case "command:ack":
          console.log("[ws] command:ack", event.data.requestId);
          break;

        case "command:error":
          console.error("[ws] command:error", event.data.requestId, event.data.error);
          break;
      }
    };

    // Fetch initial state as fallback, then connect WS
    fetchState()
      .then((state) => {
        sessionStore.setAll(state.sessions);
        agentStore.setAll(state.agents);
        taskStore.setAll(state.tasks);
        interactionStore.setAll(state.interactions);
        teamStore.setAll(state.teams ?? []);
      })
      .catch(() => {
        // REST unavailable, rely on WS snapshot
      })
      .finally(() => {
        client.connect();
      });

    return () => {
      wsStore.setWsClient(null);
      client.disconnect();
      clientRef.current = null;
    };
  }, []);
}
