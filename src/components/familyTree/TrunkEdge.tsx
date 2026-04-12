import type { EdgeProps } from 'reactflow';
import { BaseEdge } from 'reactflow';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Renders a "trunk" style edge:
 * - shared vertical segment dropping from the union point
 * - then a horizontal split to the child
 * This makes multiple union->child edges visually overlap on the trunk.
 */
export default function TrunkEdge({ id, sourceX, sourceY, targetX, targetY, markerEnd, style }: EdgeProps) {
  // Children should generally be below unions, but clamp just in case.
  const desiredSplitY = sourceY + 34;
  const maxSplitY = Math.max(sourceY, targetY - 12);
  const splitY = clamp(desiredSplitY, sourceY, maxSplitY);

  const path = `M ${sourceX} ${sourceY} L ${sourceX} ${splitY} L ${targetX} ${splitY} L ${targetX} ${targetY}`;

  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      style={{
        ...style,
        strokeWidth: 2.75,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }}
    />
  );
}
