import { useMemo } from "react";
import type { Node, Edge } from "@xyflow/react";
import { useRelevantAgents } from "../stores/agentStore";
import { useInteractionStore } from "../stores/interactionStore";
import { useRelevantTasks } from "../stores/taskStore";
import { useActiveSession } from "../stores/sessionStore";
import { AGENT_TYPE_COLORS } from "../lib/constants";
import { truncate } from "../lib/formatters";
import type { AgentNodeData } from "../components/graph/AgentNode";
import type { MessageEdgeData } from "../components/graph/MessageEdge";

export function useAgentGraph(): { nodes: Node[]; edges: Edge[] } {
  const activeSession = useActiveSession();
  const sessionAgents = useRelevantAgents();
  const interactions = useInteractionStore((s) => s.interactions);
  const tasks = useRelevantTasks();

  return useMemo(() => {
    if (!activeSession) return { nodes: [], edges: [] };

    const now = Date.now();

    const nodes: Node[] = sessionAgents.map((agent) => {
      const colors = AGENT_TYPE_COLORS[agent.type];
      return {
        id: agent.agentId,
        type: "agentNode",
        position: { x: 0, y: 0 },
        data: { agent } as AgentNodeData,
        style: {
          borderColor: `${colors.hex}66`,
        },
      };
    });

    const interactionEdges: Edge[] = interactions
      .filter((i) => {
        const fromAgent = sessionAgents.find((a) => a.agentId === i.fromAgentId);
        const toAgent = i.toAgentId
          ? sessionAgents.find((a) => a.agentId === i.toAgentId)
          : null;
        return fromAgent && (i.toAgentId === null || toAgent);
      })
      .filter((i) => i.toAgentId !== null)
      .map((interaction) => {
        const elapsed = now - new Date(interaction.timestamp).getTime();
        const isRecent = elapsed < 2000;
        return {
          id: interaction.id,
          source: interaction.fromAgentId,
          target: interaction.toAgentId!,
          type: "messageEdge",
          animated: isRecent,
          data: { interaction, isRecent } as MessageEdgeData,
        };
      });

    // Blocking edges from task dependencies
    const blockingEdges: Edge[] = [];
    for (const task of tasks) {
      if (task.blockedBy.length > 0 && task.ownerId) {
        for (const blockingTaskId of task.blockedBy) {
          const blockingTask = tasks.find((t) => t.taskId === blockingTaskId);
          if (blockingTask?.ownerId && blockingTask.ownerId !== task.ownerId) {
            blockingEdges.push({
              id: `blocking-${blockingTask.taskId}-${task.taskId}`,
              source: blockingTask.ownerId,
              target: task.ownerId,
              type: "blockingEdge",
              data: { label: truncate(task.subject, 20) },
            });
          }
        }
      }
    }

    return { nodes, edges: [...interactionEdges, ...blockingEdges] };
  }, [activeSession, sessionAgents, interactions, tasks]);
}
