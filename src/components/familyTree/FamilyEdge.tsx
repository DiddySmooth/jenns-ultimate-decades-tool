import type { EdgeProps } from 'reactflow';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * FamilyEdge: drops from the midpoint between two parents (below their heart)
 * down to a child using right-angle routing.
 */
export default function FamilyEdge({ id, sourceX, sourceY, targetX, targetY, markerEnd, data }: EdgeProps) {
  // Explicit union drop point is injected by genealogyLayout.
  const midX = (data as { midX?: number } | undefined)?.midX ?? sourceX;
  const startY = (data as { heartY?: number } | undefined)?.heartY ?? (sourceY + 20);

  const gap = targetY - startY;
  const desiredSplitY = startY + clamp(gap * 0.5, 30, 100);
  const maxSplitY = Math.max(startY, targetY - 14);
  const splitY = clamp(desiredSplitY, startY + 10, maxSplitY);

  const path = `M ${midX} ${startY} L ${midX} ${splitY} L ${targetX} ${splitY} L ${targetX} ${targetY}`;

  return (
    <path
      id={id}
      d={path}
      fill="none"
      markerEnd={markerEnd}
      stroke="rgba(0,0,0,0.35)"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}
