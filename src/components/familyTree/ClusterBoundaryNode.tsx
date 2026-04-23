import type { NodeProps } from 'reactflow';

export default function ClusterBoundaryNode({ data }: NodeProps<{ width: number; height: number; label?: string }>) {
  const width = data?.width ?? 300;
  const height = data?.height ?? 220;
  const label = data?.label ?? 'Relationship cluster';

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 18,
        border: '2px dashed rgba(93, 63, 211, 0.35)',
        background: 'rgba(93, 63, 211, 0.05)',
        boxSizing: 'border-box',
        pointerEvents: 'none',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -12,
          left: 14,
          padding: '2px 8px',
          borderRadius: 999,
          background: 'rgba(93, 63, 211, 0.12)',
          color: 'rgba(64, 45, 140, 0.9)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.02em',
          pointerEvents: 'none',
        }}
      >
        {label}
      </div>
    </div>
  );
}
