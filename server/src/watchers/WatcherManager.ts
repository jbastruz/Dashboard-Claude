import type { Store } from "../store/Store.js";
import type { ConversationStore } from "../services/ConversationStore.js";
import { SessionWatcher } from "./SessionWatcher.js";
import { SubagentWatcher } from "./SubagentWatcher.js";
import { TaskWatcher } from "./TaskWatcher.js";
import { TeamWatcher } from "./TeamWatcher.js";

/**
 * Orchestrates all file-system watchers.
 */
export class WatcherManager {
  private sessionWatcher: SessionWatcher;
  private subagentWatcher: SubagentWatcher;
  private taskWatcher: TaskWatcher;
  private teamWatcher: TeamWatcher;

  constructor(store: Store, conversationStore?: ConversationStore) {
    this.sessionWatcher = new SessionWatcher(store);
    this.subagentWatcher = new SubagentWatcher(store, conversationStore);
    this.taskWatcher = new TaskWatcher(store);
    this.teamWatcher = new TeamWatcher(store, conversationStore);
  }

  /**
   * Initialize and start all watchers.
   */
  async start(): Promise<void> {
    await Promise.all([
      this.sessionWatcher.start(),
      this.subagentWatcher.start(),
      this.taskWatcher.start(),
      this.teamWatcher.start(),
    ]);
    console.log("[dashboard] all watchers started");
  }

  /**
   * Close all watchers.
   */
  async stop(): Promise<void> {
    await Promise.all([
      this.sessionWatcher.stop(),
      this.subagentWatcher.stop(),
      this.taskWatcher.stop(),
      this.teamWatcher.stop(),
    ]);
    console.log("[dashboard] all watchers stopped");
  }
}
