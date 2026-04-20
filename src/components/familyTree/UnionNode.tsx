import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';
import type { UnionNode } from '../../types/tracker';

// Union node is a pure invisible anchor point for child edges.
// Marriage lines are drawn directly sim→sim; this node only provides
// the source handle for child edges dropping down.
export default function UnionNode(_props: NodeProps<{ union: UnionNode }>) {
  return (
    <div style={{ width: 1, height: 1, position: 'relative' }}>
      <Handle
        type="source"
        position={Position.Bottom}
        id="child-out"
        style={{ opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, bottom: 0, left: 0 }}
      />
    </div>
  );
}
