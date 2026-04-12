import { useEffect } from 'react';

export default function Toast({
  message,
  open,
  onClose,
  durationMs = 1800,
}: {
  message: string;
  open: boolean;
  onClose: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [open, onClose, durationMs]);

  if (!open) return null;

  return (
    <div className="toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}
