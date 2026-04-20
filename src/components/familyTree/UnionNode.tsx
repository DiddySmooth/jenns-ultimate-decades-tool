import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';
import type { UnionNode } from '../../types/tracker';

export default function UnionNode(_props: NodeProps<{ union: UnionNode }>) {
  const handleStyle = { opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0 };
  return (
    <div className="ft-union-heart">
      {/* Marriage line passes through: left side in, right side out */}
      <Handle type="target" position={Position.Left}  id="partner-in-left"  style={{ ...handleStyle, left: 0, top: '50%' }} />
      <Handle type="source" position={Position.Right} id="partner-in-right" style={{ ...handleStyle, right: 0, top: '50%' }} />
      {/* Children drop from bottom */}
      <Handle type="source" position={Position.Bottom} id="child-out" style={{ ...handleStyle, bottom: 0, left: '50%' }} />
      <span className="ft-union-heart-icon">❤</span>
    </div>
  );
}
