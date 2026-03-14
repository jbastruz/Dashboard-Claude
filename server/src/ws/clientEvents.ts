export type WsClientEvent =
  | { type: "command:start-session"; requestId: string; data: { cwd: string; prompt?: string; model?: string } }
  | { type: "command:send-message"; requestId: string; data: { sessionId: string; message: string } }
  | { type: "command:stop-session"; requestId: string; data: { sessionId: string } }
  | { type: "command:resume-session"; requestId: string; data: { sessionId: string; cwd?: string } };
