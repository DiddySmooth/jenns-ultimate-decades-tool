import type { NodeProps } from 'reactflow';
import type { UnionNode } from '../../types/tracker';

export default function UnionNode(props: NodeProps<{ union: UnionNode }>) {
  const u = props.data.union;
  return (
    <div className="ft-node ft-union" title={u.notes ?? 'Union'}>
      <div className="ft-union-dot" />
    </div>
  );
}
