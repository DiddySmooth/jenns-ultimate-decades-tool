import type { EdgeProps } from 'reactflow';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export default function FamilyEdge({ id, sourceX, sourceY, targetX, targetY, markerEnd, data }: EdgeProps) {
  const edgeData = (data as { midX?: number; heartY?: number; childBarY?: number } | undefined);
  const midX = edgeData?.midX ?? sourceX;
  const startY = edgeData?.heartY ?? (sourceY + 20);

  const gap = targetY - startY;
  const desiredSplitY = startY + clamp(gap * 0.5, 30, 100);
  const maxSplitY = Math.max(startY, targetY - 14);
  const childBarY = edgeData?.childBarY ?? clamp(desiredSplitY, startY + 10, maxSplitY);

  // Simple right-angle drop: parent midpoint down to childBarY, then across to child.
  const path = `M ${midX} ${startY} L ${midX} ${childBarY} L ${targetX} ${childBarY} L ${targetX} ${targetY}`;

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
