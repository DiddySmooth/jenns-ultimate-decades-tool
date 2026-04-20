import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';
import type { UnionNode } from '../../types/tracker';

// Union node renders a small heart badge centered on the marriage line.
// It acts as the anchor point for child edges dropping down.
export default function UnionNode(_props: NodeProps<{ union: UnionNode }>) {
  return (
    <div className="ft-union-heart">
      <Handle
        type="source"
        position={Position.Bottom}
        id="child-out"
        style={{ opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, bottom: 0, left: '50%' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="partner-in-left"
        style={{ opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0 }}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="partner-in-right"
        style={{ opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0 }}
      />
      <span className="ft-union-heart-icon">❤</span>
    </div>
  );
}
