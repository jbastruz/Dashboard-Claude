import { memo } from "react";
import {
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps,
  type Edge,
} from "@xyflow/react";
import type { Interaction } from "../../types/models";
import { fr } from "../../lib/fr";

export type MessageEdgeData = {
  interaction: Interaction;
  isRecent: boolean;
} & Record<string, unknown>;

export type MessageEdgeType = Edge<MessageEdgeData, "messageEdge">;

const TYPE_COLORS: Record<string, string> = {
  spawn: "#22c55e",
  message: "#3b82f6",
  task_assign: "#a855f7",
  tool_use: "#f59e0b",
};

function MessageEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<MessageEdgeType>) {
  const interaction = data?.interaction;
  const isRecent = data?.isRecent ?? false;

  if (!interaction) return null;

  const color = TYPE_COLORS[interaction.type] ?? "#6b7280";
  const label = fr.timeline[interaction.type] ?? interaction.type;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 12,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: isRecent ? 2 : 1.5,
          opacity: isRecent ? 1 : 0.5,
        }}
        className={isRecent ? "animated" : ""}
      />
      <foreignObject
        x={labelX - 40}
        y={labelY - 10}
        width={80}
        height={20}
        requiredExtensions="http://www.w3.org/1999/xhtml"
      >
        <div className="flex items-center justify-center">
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-medium"
            style={{
              backgroundColor: `${color}20`,
              color: color,
            }}
          >
            {label}
          </span>
        </div>
      </foreignObject>
    </>
  );
}

export default memo(MessageEdgeComponent);
