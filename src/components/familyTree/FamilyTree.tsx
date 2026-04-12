import { useMemo, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
} from 'reactflow';
import 'reactflow/dist/style.css';

import type { FamilyTreeState, SimEntry, UnionNode } from '../../types/tracker';
import SimNode from './SimNode';
import UnionNodeView from './UnionNode';
import { buildFamilyTree } from './familyTreeBuild';

const nodeTypes = {
  sim: SimNode,
  union: UnionNodeView,
};

interface Props {
  sims: SimEntry[];
  unions: UnionNode[];
  saved: FamilyTreeState;
  onSavedChange: (next: FamilyTreeState) => void;
}

export default function FamilyTree({ sims, unions, saved, onSavedChange }: Props) {
  const { nodes, edges } = useMemo(() => buildFamilyTree(sims, unions, saved), [sims, unions, saved]);

  const onNodesChange: OnNodesChange = useCallback(
    () => {
      // Persist only positions for now
      const nextNodes = nodes.map((n) => ({ id: n.id, type: n.type as any, position: n.position }));
      onSavedChange({ ...saved, nodes: nextNodes, edges: saved.edges ?? [] });
    },
    [nodes, saved, onSavedChange]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    () => {
      // edges are auto-derived in MVP; no-op
    },
    []
  );

  return (
    <div className="family-tree">
      <div className="sheet-header">
        <h2>Family Tree</h2>
        <span className="field-hint">Drag nodes to arrange. Tree auto-populates from Sims Info.</span>
      </div>

      <div className="family-tree-canvas">
        <ReactFlow
          nodes={nodes as Node[]}
          edges={edges as Edge[]}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}
