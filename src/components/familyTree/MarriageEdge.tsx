import type { EdgeProps } from 'reactflow';
import { BaseEdge } from 'reactflow';

export default function MarriageEdge({ id, sourceX, sourceY, targetX, targetY, style }: EdgeProps) {
  // Force perfectly horizontal line — always draw left to right
  const y = (sourceY + targetY) / 2;
  const leftX = Math.min(sourceX, targetX);
  const rightX = Math.max(sourceX, targetX);
  const midX = (leftX + rightX) / 2;

  const path = `M ${leftX} ${y} L ${rightX} ${y}`;

  return (
    <>
      <BaseEdge id={id} path={path} style={{ ...style, stroke: 'rgba(150,150,150,0.8)', strokeWidth: 2 }} />
      {/* Heart overlay centered on the line */}
      <foreignObject x={midX - 12} y={y - 12} width={24} height={24} style={{ overflow: 'visible' }}>
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
          boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
          pointerEvents: 'none',
        }}>❤</div>
      </foreignObject>
    </>
  );
}
