import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrackerSave } from '../types/tracker';

const DEBOUNCE_MS = 30_000; // 30 seconds

type PersistFn = (save: TrackerSave) => Promise<void>;

export function useDebouncedSave(persistFn: PersistFn) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<TrackerSave | null>(null);
  const [saving, setSaving] = useState(false);

  const flush = useCallback(async () => {
    if (!pendingRef.current) return;
    const save = pendingRef.current;
    pendingRef.current = null;
    setSaving(true);
    try {
      await persistFn(save);
    } finally {
      setSaving(false);
    }
  }, [persistFn]);

  const schedule = useCallback((save: TrackerSave) => {
    pendingRef.current = save;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, DEBOUNCE_MS);
  }, [flush]);

  // Flush on page unload so we don't lose data
  useEffect(() => {
    const handler = () => { flush(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [flush]);

  return { schedule, flush, saving };
}
