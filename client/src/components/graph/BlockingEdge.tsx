import { type EdgeProps, BaseEdge, getStraightPath, EdgeLabelRenderer } from "@xyflow/react";

interface BlockingEdgeData extends Record<string, unknown> {
  label: string;
}

export default function BlockingEdge({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps) {
  const [edgePath, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: "#f59e0b",
          strokeWidth: 2,
          strokeDasharray: "8 4",
        }}
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
            className="pointer-events-none absolute rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-400"
          >
            {data.label as string}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
