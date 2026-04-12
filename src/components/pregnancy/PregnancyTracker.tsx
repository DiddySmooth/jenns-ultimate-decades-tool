import { nanoid } from 'nanoid';
import { useMemo } from 'react';
import type { PregnancyCouple, PregnancyStatus, SimEntry } from '../../types/tracker';
import { getFullName } from '../../utils/lifeStage';

interface Props {
  sims: SimEntry[];
  couples: PregnancyCouple[];
  onChange: (next: PregnancyCouple[]) => void;
}

function resizeTries(existing: boolean[], nextTotal: number): boolean[] {
  const cur = existing.slice();
  if (nextTotal === cur.length) return cur;

  if (nextTotal > cur.length) {
    while (cur.length < nextTotal) cur.push(false);
    return cur;
  }

  // Shrinking: delete empty (false) first; only delete checked if needed
  let toRemove = cur.length - nextTotal;
  const next = cur.slice();

  // Remove false from the end preferentially, but preserve ordering overall
  while (toRemove > 0) {
    const idx = next.lastIndexOf(false);
    if (idx !== -1) {
      next.splice(idx, 1);
      toRemove--;
      continue;
    }
    // no empties left — remove from end
    next.pop();
    toRemove--;
  }

  return next;
}

const STATUSES: { id: PregnancyStatus; label: string }[] = [
  { id: 'trying', label: 'Trying' },
  { id: 'pregnant', label: 'Pregnant' },
  { id: 'done', label: 'Done' },
  { id: 'infertile', label: 'Infertile' },
];

export default function PregnancyTracker({ sims, couples, onChange }: Props) {
  const simOptions = useMemo(() => {
    return sims.map((s) => ({ id: s.id, label: getFullName(s) }));
  }, [sims]);

  const update = (id: string, patch: Partial<PregnancyCouple>) => {
    onChange(
      couples.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
  };

  const addRow = () => {
    onChange([
      ...couples,
      {
        id: nanoid(),
        fatherId: undefined,
        motherId: undefined,
        married: false,
        babyGen: 1,
        totalTries: 1,
        status: 'trying',
        tries: [false],
      },
    ]);
  };

  const removeRow = (id: string) => {
    onChange(couples.filter((c) => c.id !== id));
  };

  return (
    <div className="pregnancy-tracker">
      <div className="sheet-header">
        <h2>Marriage &amp; Pregnancy Tracker</h2>
        <button className="btn-primary btn-sm" onClick={addRow}>+ Add Couple</button>
      </div>

      <div className="preg-grid-wrapper">
        <div className="preg-grid-header">
          <div>Father</div>
          <div>Mother</div>
          <div>Married</div>
          <div>Baby Gen</div>
          <div>Total Tries</div>
          <div>Status</div>
          <div>Tries</div>
          <div></div>
        </div>

        {couples.map((c) => (
          <div key={c.id} className="preg-grid-row">
            <select value={c.fatherId ?? ''} onChange={(e) => update(c.id, { fatherId: e.target.value || undefined })}>
              <option value="">—</option>
              {simOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <select value={c.motherId ?? ''} onChange={(e) => update(c.id, { motherId: e.target.value || undefined })}>
              <option value="">—</option>
              {simOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <label className="checkbox-center">
              <input type="checkbox" checked={c.married} onChange={(e) => update(c.id, { married: e.target.checked })} />
            </label>
            <input type="number" min={1} value={c.babyGen} onChange={(e) => update(c.id, { babyGen: Number(e.target.value) })} />
            <input
              type="number"
              min={0}
              value={c.totalTries}
              onChange={(e) => {
                const nextTotal = Math.max(0, Number(e.target.value));
                const nextTries = resizeTries(c.tries ?? [], nextTotal);
                update(c.id, { totalTries: nextTotal, tries: nextTries });
              }}
            />
            <select value={c.status} onChange={(e) => update(c.id, { status: e.target.value as PregnancyStatus })}>
              {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>

            <div className="tries-cell">
              {(c.tries ?? []).map((t, idx) => (
                <label key={idx} className={`try-box${t ? ' checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={t}
                    onChange={(e) => {
                      const next = (c.tries ?? []).slice();
                      next[idx] = e.target.checked;
                      update(c.id, { tries: next });
                    }}
                  />
                </label>
              ))}
            </div>

            <button className="btn-ghost btn-sm btn-danger" onClick={() => removeRow(c.id)}>Remove</button>
          </div>
        ))}
      </div>

      {couples.length === 0 && (
        <p className="empty-state">No couples yet. Add one to start tracking marriage rolls and pregnancy attempts.</p>
      )}
    </div>
  );
}
