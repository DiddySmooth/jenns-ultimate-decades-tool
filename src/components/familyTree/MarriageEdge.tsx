import type { EdgeProps } from 'reactflow';

export default function MarriageEdge({ id, sourceX, sourceY, targetX, targetY }: EdgeProps) {
  // Lines come out the bottom of each card, meet at midpoint below, heart sits there
  const leftX = Math.min(sourceX, targetX);
  const rightX = Math.max(sourceX, targetX);
  const midX = (leftX + rightX) / 2;

  // Drop point below the cards — use the lower of the two bottom edges
  const bottomY = Math.max(sourceY, targetY) + 20;

  // Path: down from left card bottom, across to mid, across to right card bottom
  // Left leg: sourceX down to bottomY, then across to midX
  // Right leg: targetX down to bottomY, then across to midX
  const path = `
    M ${sourceX} ${sourceY}
    L ${sourceX} ${bottomY}
    L ${midX} ${bottomY}
    M ${targetX} ${targetY}
    L ${targetX} ${bottomY}
    L ${midX} ${bottomY}
  `;

  return (
    <g>
      <path
        id={id}
        d={path}
        fill="none"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Heart at the junction point */}
      <foreignObject x={midX - 12} y={bottomY - 12} width={24} height={24} style={{ overflow: 'visible' }}>
        <div style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: 'var(--color-surface)',
          border: '1.5px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          color: '#e05c7a',
          boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          pointerEvents: 'none',
        }}>❤</div>
      </foreignObject>
    </g>
  );
}
