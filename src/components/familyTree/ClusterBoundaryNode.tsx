import type { NodeProps } from 'reactflow';

interface ClusterBoundaryData {
  width: number;
  height: number;
  label?: string;
  family?: boolean; // true = normal family box, false/undefined = multi-union cluster
}

export default function ClusterBoundaryNode({ data }: NodeProps<ClusterBoundaryData>) {
  const width = data?.width ?? 300;
  const height = data?.height ?? 220;
  const label = data?.label;
  const isFamily = data?.family;

  return (
    <div
      style={{
        width,
        height,
        borderRadius: isFamily ? 14 : 18,
        border: isFamily
          ? '1.5px dashed rgba(120, 120, 180, 0.28)'
          : '2px dashed rgba(93, 63, 211, 0.42)',
        background: isFamily
          ? 'rgba(120, 120, 180, 0.04)'
          : 'rgba(93, 63, 211, 0.06)',
        boxSizing: 'border-box',
        pointerEvents: 'none',
        position: 'relative',
      }}
    >
      {label && (
        <div
          style={{
            position: 'absolute',
            top: -12,
            left: 14,
            padding: '2px 8px',
            borderRadius: 999,
            background: 'rgba(93, 63, 211, 0.13)',
            color: 'rgba(64, 45, 140, 0.9)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.02em',
            pointerEvents: 'none',
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
