import { useState } from 'react';
import type { SimEntry, TrackerConfig } from '../../types/tracker';
import { getFullName, computeLifeStage } from '../../utils/lifeStage';

interface Props {
  sims: SimEntry[];
  trackerConfig: TrackerConfig;
  currentDay: number;
  onSimsChange: (next: SimEntry[]) => void;
}

export default function NotesView({ sims, trackerConfig, currentDay, onSimsChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(sims[0]?.id ?? null);
  const [search, setSearch] = useState('');

  const filtered = sims.filter(s => {
    const name = getFullName(s).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const selected = sims.find(s => s.id === selectedId) ?? null;

  function updateNotes(simId: string, notes: string) {
    onSimsChange(sims.map(s => s.id === simId ? { ...s, notes } : s));
  }

  const sexColor = (sim: SimEntry) =>
    sim.sex === 'Female' ? '#e91e8c' : sim.sex === 'Male' ? '#4a90d9' : '#888';

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', overflow: 'hidden', gap: 0 }}>

      {/* Sidebar */}
      <div style={{
        width: 260, flexShrink: 0, borderRight: '1px solid var(--color-border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search sims…"
            style={{
              width: '100%', padding: '0.4rem 0.6rem', borderRadius: 8,
              border: '1px solid var(--color-border)', background: 'var(--color-surface)',
              color: 'var(--color-text)', fontSize: '0.85rem', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.length === 0 && (
            <div style={{ padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No sims found.</div>
          )}
          {filtered.map(sim => {
            const color = sexColor(sim);
            const stage = computeLifeStage(sim, trackerConfig, currentDay);
            const hasNotes = sim.notes && sim.notes.trim().length > 0;
            const isSelected = selectedId === sim.id;
            return (
              <button
                key={sim.id}
                onClick={() => setSelectedId(sim.id)}
                style={{
                  width: '100%', textAlign: 'left', padding: '0.65rem 0.85rem',
                  background: isSelected ? color + '18' : 'transparent',
                  border: 'none', borderBottom: '1px solid var(--color-border)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem',
                  borderLeft: isSelected ? `3px solid ${color}` : '3px solid transparent',
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  overflow: 'hidden', border: `2px solid ${color}55`, background: 'var(--color-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.9rem', fontWeight: 700, color,
                }}>
                  {sim.avatarUrl
                    ? <img src={sim.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (sim.firstName?.[0] ?? '?').toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {getFullName(sim)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {sim.birthYear ? `b. ${sim.birthYear}` : '—'}
                    {stage ? ` · ${stage}` : ''}
                  </div>
                </div>
                {hasNotes && (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} title="Has notes" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notes area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--color-surface)' }}>
        {!selected ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
            Select a sim to view notes
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{
              padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)',
              display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0,
              background: sexColor(selected) + '10',
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
                overflow: 'hidden', border: `2.5px solid ${sexColor(selected)}66`,
                background: 'var(--color-border)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '1.2rem', fontWeight: 700, color: sexColor(selected),
              }}>
                {selected.avatarUrl
                  ? <img src={selected.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (selected.firstName?.[0] ?? '?').toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-text)' }}>
                  {getFullName(selected)}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.2rem', display: 'flex', gap: '0.75rem' }}>
                  {selected.birthYear && <span>Born {selected.birthYear}</span>}
                  {selected.deathYear && <span>Died {selected.deathYear}</span>}
                  {computeLifeStage(selected, trackerConfig, currentDay) && (
                    <span style={{ padding: '0.1rem 0.5rem', borderRadius: 999, background: sexColor(selected) + '22', color: sexColor(selected), fontWeight: 600 }}>
                      {computeLifeStage(selected, trackerConfig, currentDay)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Notes textarea */}
            <div style={{ flex: 1, padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                Notes
              </label>
              <textarea
                value={selected.notes ?? ''}
                onChange={e => updateNotes(selected.id, e.target.value)}
                placeholder={`Write notes about ${selected.firstName}…`}
                style={{
                  flex: 1, resize: 'none', padding: '0.75rem',
                  border: '1px solid var(--color-border)', borderRadius: 10,
                  background: 'var(--color-bg)', color: 'var(--color-text)',
                  fontFamily: 'inherit', fontSize: '0.9rem', lineHeight: 1.6,
                  outline: 'none',
                }}
              />
              <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'right' }}>
                {(selected.notes ?? '').length} chars · auto-saved
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
