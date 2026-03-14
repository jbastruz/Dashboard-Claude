import { Router, type Request, type Response } from "express";
import type { Store } from "../store/Store.js";
import type { SessionManager } from "../services/SessionManager.js";
import type { ConversationStore } from "../services/ConversationStore.js";

export function createApiRouter(
  store: Store,
  sessionManager: SessionManager,
  conversationStore: ConversationStore,
): Router {
  const router = Router();

  /**
   * GET /api/state — full snapshot of all tracked state.
   */
  router.get("/state", (_req: Request, res: Response) => {
    res.json(store.getFullState());
  });

  /**
   * GET /api/sessions — list all sessions.
   */
  router.get("/sessions", (_req: Request, res: Response) => {
    const { sessions } = store.getFullState();
    res.json(sessions);
  });

  /**
   * GET /api/agents/:id — detail for a single agent.
   */
  router.get("/agents/:id", (req: Request, res: Response) => {
    const agent = store.getAgent(req.params.id as string);
    if (!agent) {
      res.status(404).json({ error: "agent not found" });
      return;
    }
    res.json(agent);
  });

  /**
   * GET /api/agents/:id/conversation — conversation history for an agent.
   */
  router.get("/agents/:id/conversation", (req: Request, res: Response) => {
    const entries = conversationStore.getConversation(req.params.id as string);
    res.json(entries);
  });

  /**
   * POST /api/sessions/start — start a new managed session.
   */
  router.post("/sessions/start", (req: Request, res: Response) => {
    try {
      const { prompt, cwd, model } = req.body as { prompt?: string; cwd?: string; model?: string };
      const sessionId = sessionManager.startSession({
        cwd: cwd ?? process.cwd(),
        prompt,
        model,
      });
      res.json({ sessionId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  /**
   * POST /api/sessions/:id/message — send a message to a managed session.
   */
  router.post("/sessions/:id/message", (req: Request, res: Response) => {
    try {
      const { content } = req.body as { content?: string };
      if (!content) {
        res.status(400).json({ error: "content is required" });
        return;
      }
      sessionManager.sendMessage(req.params.id as string, content);
      res.json({ ok: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  /**
   * DELETE /api/sessions/:id — stop a managed session.
   */
  router.delete("/sessions/:id", async (req: Request, res: Response) => {
    try {
      await sessionManager.stopSession(req.params.id as string);
      res.json({ ok: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  return router;
}
