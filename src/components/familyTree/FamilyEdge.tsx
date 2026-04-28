import type { EdgeProps } from 'reactflow';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export default function FamilyEdge({ id, sourceX, sourceY, targetX, targetY, markerEnd, data, style }: EdgeProps) {
  const edgeData = (data as { midX?: number; heartY?: number; childBarY?: number; elevated?: boolean } | undefined);
  const midX = edgeData?.midX ?? sourceX;
  const elevated = edgeData?.elevated === true;
  const startY = edgeData?.heartY ?? (sourceY + 20);
  const stroke = (style?.stroke as string) ?? 'rgba(0,0,0,0.35)';
  const strokeWidth = (style?.strokeWidth as number) ?? 2;

  let path: string;
  if (elevated) {
    // Child was elevated to the same row as their cross-gen spouse.
    // Their original parents are on the same row but to the left/right.
    // Route: exit top of card → up above the row → across to midX → down to heartY.
    const OVERHEAD = 60; // clearance above the row
    const cardTopY = targetY;          // handle is at top-center of card
    const aboveRowY = cardTopY - OVERHEAD;
    path = [
      `M ${targetX} ${cardTopY}`,      // top-center of elevated child card
      `L ${targetX} ${aboveRowY}`,      // go up above the row
      `L ${midX} ${aboveRowY}`,         // go horizontally to above parent midpoint
      `L ${midX} ${startY}`,            // drop down to parent heartY
    ].join(' ');
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
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}
