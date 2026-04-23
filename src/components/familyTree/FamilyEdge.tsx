import type { EdgeProps } from 'reactflow';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * FamilyEdge: drops from the midpoint between two parents (below their heart)
 * down to a child using right-angle routing.
 */
export default function FamilyEdge({ id, sourceX, sourceY, targetX, targetY, markerEnd, data }: EdgeProps) {
  // Explicit union drop point and optional local child band are injected by genealogyLayout.
  const edgeData = (data as { midX?: number; heartY?: number; childLeft?: number; childRight?: number; childBarY?: number } | undefined);
  const midX = edgeData?.midX ?? sourceX;
  const startY = edgeData?.heartY ?? (sourceY + 20);

  const gap = targetY - startY;
  const desiredSplitY = startY + clamp(gap * 0.5, 30, 100);
  const maxSplitY = Math.max(startY, targetY - 14);
  const childBarY = edgeData?.childBarY ?? clamp(desiredSplitY, startY + 10, maxSplitY);

  // If the union has a dedicated child band, draw a small local sibling bar first.
  const childLeft = edgeData?.childLeft;
  const childRight = edgeData?.childRight;
  const hasLocalBand = childLeft != null && childRight != null && childRight > childLeft;

  const path = hasLocalBand
    ? `M ${midX} ${startY} L ${midX} ${childBarY} L ${childLeft} ${childBarY} M ${midX} ${childBarY} L ${childRight} ${childBarY} M ${targetX} ${childBarY} L ${targetX} ${targetY}`
    : `M ${midX} ${startY} L ${midX} ${childBarY} L ${targetX} ${childBarY} L ${targetX} ${targetY}`;

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
