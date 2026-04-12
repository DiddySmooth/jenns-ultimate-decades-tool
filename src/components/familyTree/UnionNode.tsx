import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';
import type { UnionNode } from '../../types/tracker';

export default function UnionNode(props: NodeProps<{ union: UnionNode }>) {
  const u = props.data.union;
  return (
    <div className="ft-node ft-union" title={u.notes ?? 'Union'}>
      {/* partners connect in (future use) */}
      <Handle type="target" position={Position.Left} id="partner-in-left" />
      <Handle type="target" position={Position.Right} id="partner-in-right" />
      {/* children connect out */}
      <Handle type="source" position={Position.Bottom} id="child-out" />
      <div className="ft-union-dot" />
    </div>
  );
}
