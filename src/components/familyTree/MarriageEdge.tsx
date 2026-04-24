import type { EdgeProps } from 'reactflow';

type MarriageData = {
  status?: 'active' | 'divorce' | 'death' | 'ended';
  primary?: boolean;
  secondaryIndex?: number;
  multiUnion?: boolean;
  heartX?: number;
  heartY?: number;
};

export default function MarriageEdge({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps<MarriageData>) {
  const leftX = Math.min(sourceX, targetX);
  const rightX = Math.max(sourceX, targetX);

  const primary = data?.primary !== false;
  const status = data?.status ?? 'active';
  const multiUnion = data?.multiUnion === true;

  const bottomY = data?.heartY ?? (Math.max(sourceY, targetY) + 20);
  const iconMidX = data?.heartX ?? ((leftX + rightX) / 2);

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

  let path: string;
  if (multiUnion) {
    // Multi-union cluster: NO horizontal bar between partners.
    // Each partner just drops straight down to heartY.
    // Heart icon at iconMidX (between anchor and wife) indicates the pairing.
    // This avoids the single long horizontal bar spanning the whole cluster.
    path = `
      M ${sourceX} ${sourceY}
      L ${sourceX} ${bottomY}
      M ${targetX} ${targetY}
      L ${targetX} ${bottomY}
    `;
  } else {
    // Standard couple: symmetric bracket meeting at heart center.
    path = `
      M ${sourceX} ${sourceY}
      L ${sourceX} ${bottomY}
      L ${iconMidX} ${bottomY}
      M ${targetX} ${targetY}
      L ${targetX} ${bottomY}
      L ${iconMidX} ${bottomY}
    `;
  }

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
      <foreignObject x={iconMidX - 12} y={bottomY - 12} width={24} height={24} style={{ overflow: 'visible', zIndex: 1000 }}>
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
