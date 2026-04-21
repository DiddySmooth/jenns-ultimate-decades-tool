import type { EdgeProps } from 'reactflow';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * FamilyEdge: drops from the midpoint between two parents down to a child.
 * sourceX/sourceY come from partnerA's parent-out handle.
 * We receive partnerBX via edge data to calculate the true midpoint.
 */
export default function FamilyEdge({ id, sourceX, sourceY, targetX, targetY, markerEnd, style, data }: EdgeProps) {
  // If we have the partner's X, use the midpoint; otherwise fall back to sourceX
  const partnerBX = (data as { partnerBX?: number } | undefined)?.partnerBX;
  const startX = partnerBX != null ? (sourceX + partnerBX) / 2 : sourceX;

  const gap = targetY - sourceY;
  const desiredSplitY = sourceY + clamp(gap * 0.55, 36, 110);
  const maxSplitY = Math.max(sourceY, targetY - 14);
  const splitY = clamp(desiredSplitY, sourceY + 10, maxSplitY);

  const path = `M ${startX} ${sourceY} L ${startX} ${splitY} L ${targetX} ${splitY} L ${targetX} ${targetY}`;

  return (
    <path
      id={id}
      d={path}
      fill="none"
      markerEnd={markerEnd}
      style={{
        ...style,
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        stroke: 'rgba(0,0,0,0.35)',
      }}
    />
  );
}
