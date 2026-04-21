import type { AvatarCrop, SimEntry, TrackerConfig, SimSex } from '../../types/tracker';
import { nanoid } from 'nanoid';
import { useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { GENERAL_TRAITS, TODDLER_TRAITS, INFANT_TRAITS } from '../../data/simTraits';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import SortableSimRow from './SortableSimRow';
import { computeLifeStage, getFullName } from '../../utils/lifeStage';
import { migrateSimEntry } from '../../utils/migrateSim';
import AvatarCropEditor from './AvatarCropEditor';

interface Props {
  sims: SimEntry[];
  config: TrackerConfig;
  currentDay: number;
  userId: string;
  saveId: string;
  onAdd: (sim: SimEntry) => void;
  onUpdate: (sim: SimEntry) => void;
  onDelete: (id: string) => void;
  onReorder: (next: SimEntry[]) => void;
}

const blankSim = (): SimEntry => ({
  id: nanoid(),
  firstName: '',
  lastName: '',
  sex: 'Unknown',
  generation: 1,
});

export default function SimsSheet({ sims, config, currentDay, userId, saveId, onAdd, onUpdate, onDelete, onReorder }: Props) {
  const [editing, setEditing] = useState<SimEntry | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [customTraitInput, setCustomTraitInput] = useState('');

  async function uploadAvatar(file: File, simId: string) {
    const dataBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = String(reader.result || '');
        const base64 = res.split(',')[1];
        if (!base64) reject(new Error('Invalid base64'));
        else resolve(base64);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    const r = await fetch(`/api/uploadAvatar?userId=${encodeURIComponent(userId)}&saveId=${encodeURIComponent(saveId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        simId,
        mimeType: file.type,
        dataBase64,
      }),
    });

    if (!r.ok) throw new Error('Upload failed');
    return r.json() as Promise<{ blobKey: string; url: string | null }>;
  }

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

  const byId = useMemo(() => new Map(simsNormalized.map((s) => [s.id, s])), [simsNormalized]);

  const resolveName = (id?: string) => {
    if (!id) return '—';
    const sim = byId.get(id);
    return sim ? getFullName(sim) : '—';
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    if (String(active.id) === String(over.id)) return;

    const oldIndex = simsNormalized.findIndex((s) => String(s.id) === String(active.id));
    const newIndex = simsNormalized.findIndex((s) => String(s.id) === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    onReorder(arrayMove(simsNormalized, oldIndex, newIndex));
  };

  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const toggleExpanded = (id: string) => setExpandedIds((s) => ({ ...s, [id]: !s[id] }));

  return (
    <div className="sims-sheet">
      <div className="sheet-header">
        <h2>Sims Info Sheet</h2>
        <button className="btn-primary btn-sm" onClick={startNew}>+ Add Sim</button>
      </div>

      <div className="sim-table-header">
        <span />
        <span />
        <span>Name</span>
        <span>Stage</span>
        <span>Age</span>
        <span>Sex</span>
        <span>Gen</span>
        <span>Born</span>
        <span>Birthplace</span>
        <span>Father</span>
        <span>Mother</span>
        <span>Spouse</span>
        <span>Married</span>
        <span>Died</span>
        <span>COD</span>
        <span />
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={simsNormalized.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="sims-list rows">
            {simsNormalized.map((sim) => (
              <SortableSimRow
                key={sim.id}
                sim={sim}
                config={config}
                currentDay={currentDay}
                resolveName={resolveName}
                expanded={!!expandedIds[sim.id]}
                onToggleExpanded={() => toggleExpanded(sim.id)}
                onEdit={() => { setEditing({ ...sim }); setIsNew(false); }}
                onDelete={() => onDelete(sim.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

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
              <label>Maiden Name <span style={{ fontWeight: 400, textTransform: 'none', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>(optional)</span></label>
              <input type="text" value={editing.maidenName ?? ''} placeholder="Birth surname" onChange={(e) => setEditing({ ...editing, maidenName: e.target.value || undefined })} />
              {editing.maidenName && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem', fontWeight: 400, textTransform: 'none', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={editing.showMaidenName ?? false} onChange={(e) => setEditing({ ...editing, showMaidenName: e.target.checked })} />
                  Show on family tree as "{editing.firstName || 'First'} ({editing.maidenName}) {editing.lastName || 'Last'}"
                </label>
              )}
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
              <label>Avatar</label>
              <div className="avatar-upload-row">
                <div className="avatar-preview">
                  {editing.avatarUrl ? <img src={editing.avatarUrl} alt="Avatar" /> : <div className="avatar-preview-fallback">—</div>}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  disabled={avatarUploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (!editing.id) return;
                    try {
                      setAvatarUploading(true);
                      const res = await uploadAvatar(file, editing.id);
                      // New image: clear crop so it starts centered
                      setEditing({ ...editing, avatarUrl: res.url ?? undefined, avatarBlobKey: res.blobKey, avatarCrop: undefined });
                    } finally {
                      setAvatarUploading(false);
                    }
                  }}
                />
              </div>

              <div style={{ marginTop: '0.5rem' }}>
                <AvatarCropEditor
                  imageUrl={editing.avatarUrl}
                  value={editing.avatarCrop as AvatarCrop | undefined}
                  onChange={(next) => setEditing({ ...editing, avatarCrop: next as AvatarCrop | undefined })}
                />
              </div>

              <span className="field-hint">Crop is saved as metadata (no re-upload).</span>
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
              <label>Birth Day of Year</label>
              <input
                type="number"
                min={1}
                max={config.daysPerYear}
                placeholder={`1-${config.daysPerYear}`}
                value={editing.birthDayOfYear ?? ''}
                onChange={(e) => setEditing({ ...editing, birthDayOfYear: e.target.value ? Number(e.target.value) : undefined })}
              />
              <span className="field-hint">Used for accurate life stage aging. Only the birth year is shown in the main sheet.</span>
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
                value={computeLifeStage(editing, config, currentDay) || ''}
              />
              <span className="field-hint">Computed from total sim days lived, not just the year number.</span>
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
              <label>Death Day of Year</label>
              <input
                type="number"
                min={1}
                max={config.daysPerYear}
                placeholder={`1-${config.daysPerYear}`}
                value={editing.deathDayOfYear ?? ''}
                onChange={(e) => setEditing({ ...editing, deathDayOfYear: e.target.value ? Number(e.target.value) : undefined })}
              />
              <span className="field-hint">For dead sims, life stage is based on the exact sim day they died.</span>
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

            <div className="field-group">
              <label>Traits</label>
              <div className="traits-row">
                <select value="" onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  if (val === '__custom__') {
                    // Focus the custom input
                    setTimeout(() => document.getElementById('customTraitInput')?.focus(), 50);
                    (e.target as HTMLSelectElement).value = '';
                    return;
                  }
                  const next = Array.from(new Set([...(editing.traits || []), val]));
                  setEditing({ ...editing, traits: next });
                  (e.target as HTMLSelectElement).value = '';
                }}>
                  <option value="">Add a trait...</option>
                  <optgroup label="General (Child+)">
                    {GENERAL_TRAITS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </optgroup>
                  <optgroup label="Toddler Only">
                    {TODDLER_TRAITS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </optgroup>
                  <optgroup label="Infant Only">
                    {INFANT_TRAITS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </optgroup>
                  <optgroup label="Other">
                    <option value="__custom__">✏️ Custom trait...</option>
                  </optgroup>
                </select>
              </div>
              <div className="traits-custom-row" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                <input
                  id="customTraitInput"
                  type="text"
                  placeholder="Type a custom trait and press Add"
                  value={customTraitInput}
                  onChange={(e) => setCustomTraitInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const v = customTraitInput.trim();
                      if (!v) return;
                      setEditing({ ...editing, traits: Array.from(new Set([...(editing.traits || []), v])) });
                      setCustomTraitInput('');
                    }
                  }}
                  style={{ flex: 1, padding: '0.4rem 0.6rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.875rem' }}
                />
                <button className="btn-secondary btn-sm" onClick={() => {
                  const v = customTraitInput.trim();
                  if (!v) return;
                  setEditing({ ...editing, traits: Array.from(new Set([...(editing.traits || []), v])) });
                  setCustomTraitInput('');
                }}>Add</button>
              </div>
              <div className="traits-list">
                {(editing.traits || []).map((t) => (
                  <span key={t} className="cell-tag">
                    <span className="cell-tag-text">{t}</span>
                    <button className="cell-tag-remove" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditing({ ...editing, traits: (editing.traits || []).filter(x => x !== t) }); }} aria-label={`Remove trait ${t}`}>×</button>
                  </span>
                ))}
                <div className="field-hint" style={{ marginTop: '0.4rem' }}>Toddler-only and Infant-only traits are automatically lost when aging up</div>
              </div>
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
