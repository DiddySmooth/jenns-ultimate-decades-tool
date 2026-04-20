import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';
import type { UnionNode } from '../../types/tracker';

export default function UnionNode(props: NodeProps<{ union: UnionNode }>) {
  const u = props.data.union;
  // Union node is an invisible anchor — wide enough so left/right handles
  // are actually on the sides (not all at the same point)
  return (
    <div className="ft-node ft-union" title={u.notes ?? 'Union'}>
      {/* partners connect in from sides */}
      <Handle type="target" position={Position.Left} id="partner-in-left" style={{ left: 0 }} />
      <Handle type="target" position={Position.Right} id="partner-in-right" style={{ right: 0 }} />
      {/* children connect out from bottom center */}
      <Handle type="source" position={Position.Bottom} id="child-out" style={{ bottom: 0, left: '50%' }} />
    </div>
  );
}
