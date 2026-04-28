import type { EdgeProps } from 'reactflow';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export default function FamilyEdge({ id, sourceX, sourceY, targetX, targetY, markerEnd, data }: EdgeProps) {
  const edgeData = (data as { midX?: number; heartY?: number; childBarY?: number; elevated?: boolean } | undefined);
  const midX = edgeData?.midX ?? sourceX;
  const elevated = edgeData?.elevated === true;
  const startY = edgeData?.heartY ?? (sourceY + 20);

  let path: string;
  if (elevated) {
    // Child was elevated to a higher row via cross-gen union.
    // Route the line OUT THE TOP of the child card, loop up and over to the
    // parent's drop point. Uses a stepped path: up from targetY, across to
    // midX, then down to startY (the parent's heartY).
    const childTopY = targetY - 20; // exit top of child card
    const loopY = Math.min(startY, childTopY) - 30; // go above both
    path = `M ${targetX} ${targetY} L ${targetX} ${childTopY} L ${targetX} ${loopY} L ${midX} ${loopY} L ${midX} ${startY}`;
  } else {
    const gap = targetY - startY;
    const desiredSplitY = startY + clamp(gap * 0.5, 30, 100);
    const maxSplitY = Math.max(startY, targetY - 14);
    const childBarY = edgeData?.childBarY ?? clamp(desiredSplitY, startY + 10, maxSplitY);
    path = `M ${midX} ${startY} L ${midX} ${childBarY} L ${targetX} ${childBarY} L ${targetX} ${targetY}`;
  }

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
