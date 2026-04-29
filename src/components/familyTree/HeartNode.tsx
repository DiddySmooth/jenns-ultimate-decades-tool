import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

type HeartData = {
  status?: 'active' | 'divorce' | 'death' | 'ended';
  primary?: boolean;
  unlocked?: boolean;
};

export default function HeartNode({ data }: NodeProps<HeartData>) {
  const status = data?.status ?? 'active';
  const unlocked = data?.unlocked === true;

  const icon = status === 'divorce' ? '💔' : '❤';
  const iconColor = status === 'divorce' ? '#b03e5e' : status === 'death' ? '#8f8f8f' : '#e05c7a';

  return (
    <div
      style={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: 'var(--color-surface)',
        border: `1.5px solid ${status === 'divorce' ? 'rgba(176,62,94,0.35)' : 'var(--color-border)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        color: iconColor,
        boxShadow: unlocked ? '0 0 0 2px #f59e0b' : '0 1px 4px rgba(0,0,0,0.15)',
        cursor: unlocked ? 'grab' : 'default',
        userSelect: 'none',
      }}
    >
      {icon}
      {/* Invisible handles so edges can connect */}
      <Handle type="target" position={Position.Top}    id="heart-in"  style={{ opacity: 0, width: 1, height: 1 }} />
      <Handle type="source" position={Position.Bottom} id="heart-out" style={{ opacity: 0, width: 1, height: 1 }} />
    </div>
  );
}
