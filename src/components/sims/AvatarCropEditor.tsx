import { useEffect, useMemo, useRef, useState } from 'react';

import type { AvatarCrop } from '../../types/tracker';

interface Props {
  imageUrl?: string;
  value?: AvatarCrop;
  onChange: (next: AvatarCrop | undefined) => void;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export default function AvatarCropEditor({ imageUrl, value, onChange }: Props) {
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  const crop = useMemo<AvatarCrop>(() => {
    return {
      x: value?.x ?? 50,
      y: value?.y ?? 50,
      zoom: value?.zoom ?? 1,
    };
  }, [value?.x, value?.y, value?.zoom]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const st = dragStart.current;
      if (!st) return;

      // Convert pixels -> % in a way that feels reasonable.
      // 160px-ish editor area, so 1px ~ 0.35%.
      const dx = e.clientX - st.px;
      const dy = e.clientY - st.py;
      const factor = 0.35;

      const next = {
        ...crop,
        x: clamp(st.x - dx * factor, 0, 100),
        y: clamp(st.y - dy * factor, 0, 100),
      };
      onChange(next);
    };

    const onUp = () => {
      if (!dragging) return;
      setDragging(false);
      dragStart.current = null;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, crop, onChange]);

  if (!imageUrl) {
    return (
      <div className="avatar-crop-empty">
        <div className="field-hint">Upload an avatar to enable crop controls.</div>
      </div>
    );
  }

  return (
    <div className="avatar-crop-editor">
      <div
        className="avatar-crop-preview"
        style={{
          backgroundImage: `url(${imageUrl})`,
          backgroundPosition: `${crop.x}% ${crop.y}%`,
          backgroundSize: `${crop.zoom * 100}% ${crop.zoom * 100}%`,
        }}
        title="Drag to reposition"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          setDragging(true);
          dragStart.current = { px: e.clientX, py: e.clientY, x: crop.x, y: crop.y };
        }}
      />

      <div className="avatar-crop-controls">
        <label className="field-hint">Zoom</label>
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={crop.zoom}
          onChange={(e) => onChange({ ...crop, zoom: Number(e.target.value) })}
        />

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
          <button className="btn-ghost btn-sm" onClick={() => onChange(undefined)} title="Clear crop (back to default)">
            Reset
          </button>
          <button
            className="btn-ghost btn-sm"
            onClick={() => onChange({ x: 50, y: 50, zoom: 1 })}
            title="Center + no zoom"
          >
            Center
          </button>
        </div>
      </div>

      <div className="field-hint" style={{ marginTop: '0.35rem' }}>
        Tip: drag the preview to reposition, then use zoom.
      </div>
    </div>
  );
}
