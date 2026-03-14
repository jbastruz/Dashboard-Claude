import type { FullState } from "../types/models";
import type { ConversationEntry } from "../types/ws-events";
import { API_URL } from "../lib/constants";

export async function fetchState(): Promise<FullState> {
  const res = await fetch(`${API_URL}/api/state`);
  if (!res.ok) {
    throw new Error(`Failed to fetch state: ${res.status}`);
  }
  return res.json();
}

export async function startSession(prompt: string, cwd?: string): Promise<{ sessionId: string }> {
  const res = await fetch(`${API_URL}/api/sessions/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, cwd }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(body.error ?? `Failed to start session: ${res.status}`);
  }
  return res.json();
}

export async function sendChatMessage(
  sessionId: string,
  content: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    throw new Error(`Failed to send message: ${res.status}`);
  }
}

export async function stopSession(sessionId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(body.error ?? `Failed to stop session: ${res.status}`);
  }
}

export async function fetchAgentConversation(
  agentId: string,
): Promise<ConversationEntry[]> {
  const res = await fetch(`${API_URL}/api/agents/${agentId}/conversation`);
  if (!res.ok) {
    throw new Error(`Failed to fetch conversation: ${res.status}`);
  }
  return res.json();
}
