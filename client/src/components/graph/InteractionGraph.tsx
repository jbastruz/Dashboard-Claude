import { useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useAgentGraph } from "../../hooks/useAgentGraph";
import { useAutoLayout } from "../../hooks/useAutoLayout";
import AgentNode from "./AgentNode";
import MessageEdge from "./MessageEdge";
import BlockingEdge from "./BlockingEdge";

const nodeTypes: NodeTypes = {
  agentNode: AgentNode,
};

const edgeTypes: EdgeTypes = {
  messageEdge: MessageEdge,
  blockingEdge: BlockingEdge,
};

function GraphCanvas() {
  const { nodes: rawNodes, edges: rawEdges } = useAgentGraph();
  const { nodes, edges } = useAutoLayout(rawNodes, rawEdges);
  const { fitView } = useReactFlow();

  useEffect(() => {
    // Wait a frame for layout to settle before fitting
    const timer = setTimeout(() => fitView({ padding: 0.2 }), 50);
    return () => clearTimeout(timer);
  }, [nodes.length, edges.length, fitView]);

  const onInit = useCallback(() => {
    fitView({ padding: 0.2 });
  }, [fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onInit={onInit}
      fitView
      proOptions={{ hideAttribution: true }}
      className="rounded-lg"
    >
      <Background color="var(--color-claude-grid)" gap={24} size={1} />
      <Controls position="bottom-right" />
      <MiniMap
        position="bottom-left"
        nodeColor="#e07a3a"
        maskColor="var(--color-claude-minimap-mask)"
      />
    </ReactFlow>
  );
}

export default function InteractionGraph() {
  return (
    <div className="h-full w-full rounded-lg border border-claude-border bg-claude-bg">
      <ReactFlowProvider>
        <GraphCanvas />
      </ReactFlowProvider>
    </div>
  );
}
