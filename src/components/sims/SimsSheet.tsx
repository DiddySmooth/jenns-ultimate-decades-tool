import type { SimEntry, TrackerConfig, SimSex } from '../../types/tracker';
import { nanoid } from 'nanoid';
import { useMemo, useState } from 'react';
import { computeLifeStage, getFullName } from '../../utils/lifeStage';
import { migrateSimEntry } from '../../utils/migrateSim';
import { formatYear, getBirthYear, getDeathYear } from '../../utils/simDates';

interface Props {
  sims: SimEntry[];
  config: TrackerConfig;
  onAdd: (sim: SimEntry) => void;
  onUpdate: (sim: SimEntry) => void;
  onDelete: (id: string) => void;
}

const blankSim = (): SimEntry => ({
  id: nanoid(),
  firstName: '',
  lastName: '',
  sex: 'Unknown',
  generation: 1,
});

export default function SimsSheet({ sims, config, onAdd, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState<SimEntry | null>(null);
  const [isNew, setIsNew] = useState(false);

  const simsNormalized = useMemo(() => sims.map(migrateSimEntry), [sims]);
  const simOptions = useMemo(() => simsNormalized.map((s) => ({ id: s.id, label: getFullName(s) })), [simsNormalized]);

  const startNew = () => {
    setEditing(blankSim());
    setIsNew(true);
  };

  const save = () => {
    if (!editing) return;

    // Keep legacy name field populated for any old code paths
    const normalized: SimEntry = {
      ...editing,
      name: `${editing.firstName} ${editing.lastName}`.trim(),
    };

    if (isNew) onAdd(normalized);
    else onUpdate(normalized);

    setEditing(null);
    setIsNew(false);
  };

  const generations = Array.from(new Set(simsNormalized.map((s) => s.generation))).sort((a, b) => a - b);

  return (
    <div className="sims-sheet">
      <div className="sheet-header">
        <h2>Sims Info Sheet</h2>
        <button className="btn-primary btn-sm" onClick={startNew}>+ Add Sim</button>
      </div>

      {generations.map((gen) => (
        <div key={gen} className="gen-group">
          <h3 className="gen-label">Generation {gen}</h3>
          <div className="sims-list">
            {simsNormalized.filter((s) => s.generation === gen).map((sim) => {
              const stage = computeLifeStage(sim, config, (config as any).currentDay ?? 1);
              const fullName = getFullName(sim);
              const birthYear = getBirthYear(sim, config);
              const deathYear = getDeathYear(sim, config);

              return (
                <div key={sim.id} className={`sim-card${sim.dateOfDeath || deathYear ? ' deceased' : ''}`}>
                  <div className="sim-card-header">
                    <strong>{fullName}</strong>
                    <span className="sim-stage">{stage || sim.currentLifeStage || ''}</span>
                  </div>
                  <div className="sim-card-meta">
                    <span>Born: {formatYear(birthYear)}</span>
                    {(sim.dateOfDeath || deathYear) && (
                      <span>
                        Died: {formatYear(deathYear)}
                        {sim.causeOfDeath ? ` (${sim.causeOfDeath})` : ''}
                      </span>
                    )}
                    {sim.placeOfBirth && <span>Birthplace: {sim.placeOfBirth}</span>}
                  </div>
                  <div className="sim-card-actions">
                    <button className="btn-ghost btn-sm" onClick={() => { setEditing({ ...sim }); setIsNew(false); }}>Edit</button>
                    <button className="btn-ghost btn-sm btn-danger" onClick={() => onDelete(sim.id)}>Remove</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {sims.length === 0 && (
        <p className="empty-state">No sims yet. Add your founder to get started.</p>
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{isNew ? 'Add Sim' : 'Edit Sim'}</h3>

            <div className="field-group">
              <label>First Name</label>
              <input type="text" value={editing.firstName} onChange={(e) => setEditing({ ...editing, firstName: e.target.value })} />
            </div>
            <div className="field-group">
              <label>Last Name</label>
              <input type="text" value={editing.lastName} onChange={(e) => setEditing({ ...editing, lastName: e.target.value })} />
            </div>
            <div className="field-group">
              <label>Sex</label>
              <select value={editing.sex ?? 'Unknown'} onChange={(e) => setEditing({ ...editing, sex: e.target.value as SimSex })}>
                {(['Female','Male','Intersex','Non-binary','Unknown'] as SimSex[]).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label>Generation</label>
              <input type="number" min={1} value={editing.generation} onChange={(e) => setEditing({ ...editing, generation: Number(e.target.value) })} />
            </div>
            <div className="field-group">
              <label>Birth Year</label>
              <input
                type="number"
                placeholder="e.g. 1890"
                value={editing.birthYear ?? ''}
                onChange={(e) => setEditing({ ...editing, birthYear: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>

            <div className="field-group">
              <label>Place of Birth</label>
              <input
                type="text"
                value={editing.placeOfBirth ?? ''}
                onChange={(e) => setEditing({ ...editing, placeOfBirth: e.target.value || undefined })}
              />
            </div>

            <div className="field-group">
              <label>Life Stage (auto)</label>
              <input
                type="text"
                readOnly
                value={computeLifeStage(editing, config, (config as any).currentDay ?? 1) || ''}
              />
              <span className="field-hint">Computed from Birth Year + current timeline year.</span>
            </div>
            <div className="field-group">
              <label>Death Year</label>
              <input
                type="number"
                placeholder="Leave blank if alive"
                value={editing.deathYear ?? ''}
                onChange={(e) => setEditing({ ...editing, deathYear: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
            <div className="field-group">
              <label>Cause of Death</label>
              <input type="text" value={editing.causeOfDeath ?? ''} onChange={(e) => setEditing({ ...editing, causeOfDeath: e.target.value || undefined })} />
            </div>

            <div className="field-group">
              <label>Father</label>
              <select value={editing.fatherId ?? ''} onChange={(e) => setEditing({ ...editing, fatherId: e.target.value || undefined })}>
                <option value="">—</option>
                {simOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>

            <div className="field-group">
              <label>Mother</label>
              <select value={editing.motherId ?? ''} onChange={(e) => setEditing({ ...editing, motherId: e.target.value || undefined })}>
                <option value="">—</option>
                {simOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>

            <div className="field-group">
              <label>Spouse</label>
              <select value={editing.spouseId ?? ''} onChange={(e) => setEditing({ ...editing, spouseId: e.target.value || undefined })}>
                <option value="">—</option>
                {simOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>

            <div className="field-group">
              <label>Marriage Year</label>
              <input
                type="number"
                value={editing.marriageYear ?? ''}
                onChange={(e) => setEditing({ ...editing, marriageYear: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
            <div className="field-group">
              <label>Notes</label>
              <textarea value={editing.notes ?? ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value || undefined })} rows={3} />
            </div>

            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
