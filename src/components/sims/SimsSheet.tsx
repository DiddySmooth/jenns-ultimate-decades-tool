import type { SimEntry, TrackerConfig } from '../../types/tracker';
import { nanoid } from 'nanoid';
import { useState } from 'react';

interface Props {
  sims: SimEntry[];
  config: TrackerConfig;
  onAdd: (sim: SimEntry) => void;
  onUpdate: (sim: SimEntry) => void;
  onDelete: (id: string) => void;
}

const blankSim = (): SimEntry => ({
  id: nanoid(),
  name: '',
  dateOfBirth: '',
  currentLifeStage: '',
  generation: 1,
});

export default function SimsSheet({ sims, config, onAdd, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState<SimEntry | null>(null);
  const [isNew, setIsNew] = useState(false);

  const allLifeStages = config.humanAging.lifeStages.map((ls) => ls.name);

  const startNew = () => {
    setEditing(blankSim());
    setIsNew(true);
  };

  const save = () => {
    if (!editing) return;
    if (isNew) onAdd(editing);
    else onUpdate(editing);
    setEditing(null);
    setIsNew(false);
  };

  const generations = Array.from(new Set(sims.map((s) => s.generation))).sort((a, b) => a - b);

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
            {sims.filter((s) => s.generation === gen).map((sim) => (
              <div key={sim.id} className={`sim-card${sim.dateOfDeath ? ' deceased' : ''}`}>
                <div className="sim-card-header">
                  <strong>{sim.name || '(unnamed)'}</strong>
                  <span className="sim-stage">{sim.currentLifeStage}</span>
                </div>
                <div className="sim-card-meta">
                  <span>Born: {sim.dateOfBirth || '—'}</span>
                  {sim.dateOfDeath && <span>Died: {sim.dateOfDeath} {sim.causeOfDeath ? `(${sim.causeOfDeath})` : ''}</span>}
                </div>
                <div className="sim-card-actions">
                  <button className="btn-ghost btn-sm" onClick={() => { setEditing({ ...sim }); setIsNew(false); }}>Edit</button>
                  <button className="btn-ghost btn-sm btn-danger" onClick={() => onDelete(sim.id)}>Remove</button>
                </div>
              </div>
            ))}
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
              <label>Name</label>
              <input type="text" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div className="field-group">
              <label>Generation</label>
              <input type="number" min={1} value={editing.generation} onChange={(e) => setEditing({ ...editing, generation: Number(e.target.value) })} />
            </div>
            <div className="field-group">
              <label>Date of Birth</label>
              <input type="text" placeholder="e.g. Day 1, Year 1890" value={editing.dateOfBirth} onChange={(e) => setEditing({ ...editing, dateOfBirth: e.target.value })} />
            </div>
            <div className="field-group">
              <label>Life Stage</label>
              <select value={editing.currentLifeStage} onChange={(e) => setEditing({ ...editing, currentLifeStage: e.target.value })}>
                <option value="">— select —</option>
                {allLifeStages.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="field-group">
              <label>Date of Death</label>
              <input type="text" placeholder="Leave blank if alive" value={editing.dateOfDeath ?? ''} onChange={(e) => setEditing({ ...editing, dateOfDeath: e.target.value || undefined })} />
            </div>
            <div className="field-group">
              <label>Cause of Death</label>
              <input type="text" value={editing.causeOfDeath ?? ''} onChange={(e) => setEditing({ ...editing, causeOfDeath: e.target.value || undefined })} />
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
