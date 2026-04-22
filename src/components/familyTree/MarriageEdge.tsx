import type { EdgeProps } from 'reactflow';

type MarriageData = {
  status?: 'active' | 'divorce' | 'death' | 'ended';
  primary?: boolean;
  secondaryIndex?: number;
};

export default function MarriageEdge({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps<MarriageData>) {
  const leftX = Math.min(sourceX, targetX);
  const rightX = Math.max(sourceX, targetX);
  const midX = (leftX + rightX) / 2;

  const primary = data?.primary !== false;
  const status = data?.status ?? 'active';
  const secondaryIndex = data?.secondaryIndex ?? 0;

  // Secondary unions get their own routing lane so multiple wives / remarriages
  // don't all collapse into the same visual path around the shared spouse.
  const laneY = primary ? 0 : (secondaryIndex * 16);
  const laneX = primary ? 0 : (((secondaryIndex % 2 === 1 ? 1 : -1) * Math.ceil(secondaryIndex / 2)) * 14);
  const bottomY = Math.max(sourceY, targetY) + 20 + laneY;
  const iconMidX = midX + laneX;

  const path = primary ? `
    M ${sourceX} ${sourceY}
    L ${sourceX} ${bottomY}
    L ${midX} ${bottomY}
    M ${targetX} ${targetY}
    L ${targetX} ${bottomY}
    L ${midX} ${bottomY}
  ` : `
    M ${sourceX} ${sourceY}
    L ${sourceX} ${bottomY}
    L ${iconMidX} ${bottomY}
    M ${targetX} ${targetY}
    L ${targetX} ${bottomY}
    L ${iconMidX} ${bottomY}
  `;

  const stroke = status === 'divorce'
    ? 'rgba(176, 62, 94, 0.7)'
    : status === 'death'
    ? 'rgba(0,0,0,0.28)'
    : status === 'ended'
    ? 'rgba(0,0,0,0.28)'
    : 'rgba(0,0,0,0.35)';

  const dash = status === 'divorce' || status === 'ended' || status === 'death' ? '5 4' : undefined;
  const icon = status === 'divorce' ? '💔' : '❤';
  const iconColor = status === 'divorce' ? '#b03e5e' : status === 'death' ? '#8f8f8f' : '#e05c7a';
  const iconOpacity = primary ? 1 : 0.92;

  return (
    <g>
      <path
        id={id}
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={primary ? 2.5 : 2}
        strokeDasharray={dash}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <foreignObject x={iconMidX - 12} y={bottomY - 12} width={24} height={24} style={{ overflow: 'visible' }}>
        <div style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: 'var(--color-surface)',
          border: `1.5px solid ${status === 'divorce' ? 'rgba(176, 62, 94, 0.35)' : 'var(--color-border)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          color: iconColor,
          opacity: iconOpacity,
          boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          pointerEvents: 'none',
        }}>{icon}</div>
      </foreignObject>
    </g>
  );
}
