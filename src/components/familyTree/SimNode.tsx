import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';
import type { SimEntry } from '../../types/tracker';
import { getFullName } from '../../utils/lifeStage';

export default function SimNode(props: NodeProps<{ sim: SimEntry }>) {
  const sim = props.data.sim;
  const name = getFullName(sim);
  const avatar = sim.avatarUrl;

  return (
    <div className="ft-node ft-sim">
      {/* incoming: parents/union */}
      <Handle type="target" position={Position.Top} />
      {/* outgoing: to union / to children (fallback) */}
      <Handle type="source" position={Position.Bottom} />

      <div className="ft-avatar">
        {avatar ? <img src={avatar} alt={name} /> : <div className="ft-avatar-fallback">{name.slice(0, 1).toUpperCase()}</div>}
      </div>
      <div className="ft-name" title={name}>{name}</div>
    </div>
  );
}
