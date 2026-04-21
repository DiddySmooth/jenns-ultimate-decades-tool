import type { EdgeProps } from 'reactflow';

// MarriageEdge: draws a perfectly horizontal line between two nodes
// at a fixed Y offset (avatar center) regardless of handle positions.
// This bypasses ReactFlow's handle geometry which causes diagonal lines
// when cards have different measured heights.
export default function MarriageEdge({ id, sourceX, sourceY, targetX, targetY, style, markerEnd }: EdgeProps) {
  // Use the average Y of source and target to guarantee horizontal line
  // Both should be the same Y since we force same Y in layout, but average for safety
  const y = (sourceY + targetY) / 2;

  const path = `M ${sourceX} ${y} L ${targetX} ${y}`;

  return (
    <g>
      <path
        id={id}
        d={path}
        fill="none"
        style={{
          ...style,
          stroke: 'rgba(150,150,150,0.8)',
          strokeWidth: 2,
        }}
        markerEnd={markerEnd}
      />
    </g>
  );
}
