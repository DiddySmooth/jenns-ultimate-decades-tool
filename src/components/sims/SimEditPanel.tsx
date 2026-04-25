import { useEffect, useMemo, useState } from 'react';
import type { AvatarCrop, SimEntry, TrackerConfig, SimSex, SimsSheetConfig, UnionNode, FamilyTreeConfig } from '../../types/tracker';
import AvatarCropEditor from './AvatarCropEditor';
import { getFullName } from '../../utils/lifeStage';
import { GENERAL_TRAITS, TODDLER_TRAITS, INFANT_TRAITS } from '../../data/simTraits';
import { nanoid } from 'nanoid';

interface Props {
  sim: SimEntry | null;
  allSims: SimEntry[];
  unions: UnionNode[];
  open: boolean;
  onClose: () => void;
  onSave: (s: SimEntry) => void;
  trackerConfig: TrackerConfig;
  treeConfig?: FamilyTreeConfig;
  sheetConfig: SimsSheetConfig;
  onUnionsChange?: (next: UnionNode[]) => void;
  isPremium: boolean;
  userId: string;
  saveId: string;
  currentDay: number;
}

export default function SimEditPanel({ sim, allSims, unions, open, onClose, onSave, trackerConfig, treeConfig, sheetConfig, onUnionsChange, isPremium, userId, saveId, currentDay }: Props) {
  const [tab, setTab] = useState<'overview'|'edit'|'photos'>('overview');
  const [editing, setEditing] = useState<SimEntry | null>(sim);
  const [uploading, setUploading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [customTraitInput, setCustomTraitInput] = useState('');

  useEffect(() => { setEditing(sim); setTab('overview'); }, [sim]);

  const byId = useMemo(() => new Map(allSims.map((s) => [s.id, s])), [allSims]);

  if (!open || !sim || !editing) return null;

  const sexColor = sim.sex === 'Female' ? '#e91e8c' : sim.sex === 'Male' ? '#4a90d9' : '#888';
  const sexBg = sim.sex === 'Female' ? 'rgba(249,168,201,0.13)' : sim.sex === 'Male' ? 'rgba(147,197,253,0.13)' : 'rgba(128,128,128,0.08)';
  const avatarRadius = treeConfig?.avatarShape === 'circle' ? '50%' : treeConfig?.avatarShape === 'rounded' ? '14px' : '6px';

  const resolveName = (id?: string) => { if (!id) return '—'; const s = byId.get(id); return s ? getFullName(s) : '—'; };

  const lifeStages = trackerConfig.humanAging?.lifeStages ?? [];

  async function uploadPhoto(file: File, simId: string) {
    const dataBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => { const b = String(reader.result || '').split(',')[1]; b ? resolve(b) : reject(new Error('bad base64')); };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const r = await fetch(`/api/uploadAvatar?userId=${encodeURIComponent(userId)}&saveId=${encodeURIComponent(saveId)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simId, mimeType: file.type, dataBase64 }),
    });
    if (!r.ok) throw new Error('Upload failed');
    return r.json() as Promise<{ blobKey: string; url: string | null }>;
  }

  async function uploadAvatar(file: File, simId: string) {
    return uploadPhoto(file, simId);
  }

  const unionsForSim = (simId?: string) => (unions ?? []).filter((u) => u.partnerAId === simId || u.partnerBId === simId);

  const formatUnionLabel = (u: UnionNode, simId?: string) => {
    const partnerId = u.partnerAId === simId ? u.partnerBId : u.partnerAId;
    const partnerName = resolveName(partnerId);
    const start = u.startYear != null ? `Year ${u.startYear}${u.startDayOfYear ? ` Day ${u.startDayOfYear}` : ''}` : 'Unknown start';
    const end = u.endYear != null ? `Year ${u.endYear}${u.endDayOfYear ? ` Day ${u.endDayOfYear}` : ''}` : 'Present';
    const state = u.endYear == null ? 'Active' : (u.endReason === 'death' ? 'Ended by death' : u.endReason === 'divorce' ? 'Ended by divorce' : 'Ended');
    return `${partnerName} · ${start} → ${end} · ${state}`;
  };

  const save = () => { if (!editing) return; onSave(editing); };

  const computeAge = () => sim.birthYear ? (sim.deathYear ? sim.deathYear - sim.birthYear : Math.floor(currentDay / trackerConfig.daysPerYear) - sim.birthYear) : '—';

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.18)', zIndex: 119, backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'fixed', right: 0, top: 0, height: '100vh', width: 520, background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)', zIndex: 120, boxShadow: '-12px 0 40px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ background: sexBg, padding: '1.25rem 1.25rem 0', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: avatarRadius, overflow: 'hidden', border: `3px solid ${sexColor}`, flexShrink: 0, background: 'var(--color-border)' }}>
              {sim.avatarUrl ? <img src={sim.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: sexColor, fontWeight: 700 }}>{(sim.firstName?.[0] ?? '?').toUpperCase()}</div>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)' }}>{getFullName(sim)}</h3>
              <div style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{sim.birthYear}{sim.deathYear ? ` – ${sim.deathYear}` : ''}</div>
            </div>

            <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--color-text-muted)', padding: '0 0.25rem', lineHeight: 1, flexShrink: 0 }}>×</button>
          </div>

          <div style={{ display: 'flex', gap: 0, marginTop: '1rem' }}>
            {(['overview','edit','photos'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '0.6rem 0', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: tab === t ? 700 : 500, background: 'none', color: tab === t ? sexColor : 'var(--color-text-muted)', borderBottom: tab === t ? `2.5px solid ${sexColor}` : '2.5px solid transparent' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1rem' }}>
          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                {[{ label: 'Born', value: sim.birthYear ?? '—' }, { label: 'Died', value: sim.deathYear ?? '—' }, { label: 'Age', value: computeAge() }].map(({ label, value }) => (
                  <div key={label} style={{ padding: '0.75rem', borderRadius: 10, background: 'var(--color-border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.2rem', color: 'var(--color-text)' }}>{String(value)}</div>
                  </div>
                ))}
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Parents</div>
                {(() => {
                  const parents = [sim.fatherId && allSims.find(s => s.id === sim.fatherId), sim.motherId && allSims.find(s => s.id === sim.motherId)].filter(Boolean) as SimEntry[];
                  const items = parents.map(p => getFullName(p));
                  return items.length === 0 ? <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>—</div> : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>{items.map((name, i) => <div key={i} style={{ padding: '0.4rem 0.75rem', borderRadius: 8, background: 'var(--color-border)', fontSize: '0.875rem', color: 'var(--color-text)' }}>{name}</div>)}</div>;
                })()}
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Children</div>
                {(() => { const children = allSims.filter(s => s.fatherId === sim.id || s.motherId === sim.id); const items = children.map(c => getFullName(c)); return items.length === 0 ? <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>—</div> : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>{items.map((name, i) => <div key={i} style={{ padding: '0.4rem 0.75rem', borderRadius: 8, background: 'var(--color-border)', fontSize: '0.875rem', color: 'var(--color-text)' }}>{name}</div>)}</div>; })()}
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Partners</div>
                {(() => { const parts = unionsForSim(sim.id); return parts.length === 0 ? <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>—</div> : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>{parts.map((u) => <div key={u.id} style={{ padding: '0.4rem 0.75rem', borderRadius: 8, background: 'var(--color-border)', fontSize: '0.875rem', color: 'var(--color-text)' }}>{formatUnionLabel(u, sim.id)}</div>)}</div>; })()}
              </div>
            </div>
          )}

          {tab === 'edit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Identity</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="field-group"><label>First Name</label><input value={editing.firstName} onChange={(e) => setEditing({ ...editing, firstName: e.target.value })} /></div>
                <div className="field-group"><label>Last Name</label><input value={editing.lastName} onChange={(e) => setEditing({ ...editing, lastName: e.target.value })} /></div>
              </div>

              <div className="field-group"><label>Maiden Name</label><input value={editing.maidenName ?? ''} onChange={(e) => setEditing({ ...editing, maidenName: e.target.value || undefined })} /></div>

              <div className="field-group"><label>Sex</label><select value={editing.sex ?? 'Unknown'} onChange={(e) => setEditing({ ...editing, sex: e.target.value as SimSex })}>{(['Female','Male','Intersex','Non-binary','Unknown'] as SimSex[]).map((s) => (<option key={s} value={s}>{s}</option>))}</select></div>

              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Avatar</div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <label style={{ display: 'inline-block', padding: '0.5rem 1rem', borderRadius: 8, background: avatarUploading ? 'var(--color-border)' : (editing.sex === 'Female' ? '#e91e8c22' : editing.sex === 'Male' ? '#4a90d922' : '#888122'), color: editing.sex === 'Female' ? '#e91e8c' : editing.sex === 'Male' ? '#4a90d9' : '#888', border: `1px solid ${editing.sex === 'Female' ? '#e91e8c44' : editing.sex === 'Male' ? '#4a90d944' : '#888244'}`, cursor: avatarUploading ? 'not-allowed' : 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                  {avatarUploading ? 'Uploading…' : '📷 Change Photo'}
                  <input type="file" accept="image/*" disabled={avatarUploading} style={{ display: 'none' }} onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; if (!editing.id) return; try { setAvatarUploading(true); const res = await uploadAvatar(file, editing.id); setEditing({ ...editing, avatarUrl: res.url ?? undefined, avatarBlobKey: res.blobKey, avatarCrop: undefined }); } finally { setAvatarUploading(false); e.target.value = ''; } }} />
                </label>
                {editing.avatarUrl && (<AvatarCropEditor imageUrl={editing.avatarUrl} value={editing.avatarCrop as AvatarCrop | undefined} onChange={(next) => setEditing({ ...editing, avatarCrop: next as AvatarCrop | undefined })} />)}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="field-group"><label>Birth Year</label><input type="number" value={editing.birthYear ?? ''} onChange={(e) => setEditing({ ...editing, birthYear: e.target.value ? Number(e.target.value) : undefined })} /></div>
                <div className="field-group"><label>Birth Day</label><input type="number" min={1} max={trackerConfig.daysPerYear} value={editing.birthDayOfYear ?? ''} onChange={(e) => setEditing({ ...editing, birthDayOfYear: e.target.value ? Number(e.target.value) : undefined })} /></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="field-group"><label>Death Year</label><input type="number" value={editing.deathYear ?? ''} onChange={(e) => setEditing({ ...editing, deathYear: e.target.value ? Number(e.target.value) : undefined })} /></div>
                <div className="field-group"><label>Death Day</label><input type="number" min={1} max={trackerConfig.daysPerYear} value={editing.deathDayOfYear ?? ''} onChange={(e) => setEditing({ ...editing, deathDayOfYear: e.target.value ? Number(e.target.value) : undefined })} /></div>
              </div>

              {sheetConfig.showTraits && (
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Traits</div>
                  <div className="field-group">
                    <select value="" onChange={(e) => { const val = e.target.value; if (!val) return; if (val === '__custom__') { setTimeout(() => document.getElementById('customTraitInput')?.focus(), 50); (e.target as HTMLSelectElement).value = ''; return; } const next = Array.from(new Set([...(editing.traits || []), val])); setEditing({ ...editing, traits: next }); (e.target as HTMLSelectElement).value = ''; }}>
                      <option value="">Add a trait...</option>
                      <optgroup label="General (Child+)">{GENERAL_TRAITS.map((t) => <option key={t} value={t}>{t}</option>)}</optgroup>
                      <optgroup label="Toddler Only">{TODDLER_TRAITS.map((t) => <option key={t} value={t}>{t}</option>)}</optgroup>
                      <optgroup label="Infant Only">{INFANT_TRAITS.map((t) => <option key={t} value={t}>{t}</option>)}</optgroup>
                      <optgroup label="Other"><option value="__custom__">✏️ Custom trait...</option></optgroup>
                    </select>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                      <input id="customTraitInput" type="text" placeholder="Type a custom trait and press Add" value={customTraitInput} onChange={(e) => setCustomTraitInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const v = customTraitInput.trim(); if (!v) return; setEditing({ ...editing, traits: Array.from(new Set([...(editing.traits || []), v])) }); setCustomTraitInput(''); } }} style={{ flex: 1, padding: '0.4rem 0.6rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.875rem' }} />
                      <button className="btn-secondary btn-sm" onClick={() => { const v = customTraitInput.trim(); if (!v) return; setEditing({ ...editing, traits: Array.from(new Set([...(editing.traits || []), v])) }); setCustomTraitInput(''); }}>Add</button>
                    </div>
                    <div style={{ marginTop: '0.5rem' }}>{(editing.traits || []).map((t) => (<span key={t} className="cell-tag" style={{ marginRight: 6 }}><span className="cell-tag-text">{t}</span><button className="cell-tag-remove" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditing({ ...editing, traits: (editing.traits || []).filter(x => x !== t) }); }} aria-label={`Remove trait ${t}`}>×</button></span>))}</div>
                  </div>
                </div>
              )}

              {sheetConfig.showNotes && (<div className="field-group"><label>Notes</label><textarea value={editing.notes ?? ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value || undefined })} style={{ minHeight: 120 }} /></div>)}

              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Relationships</div>
                <div className="field-group"><label>Father</label><select value={editing.fatherId ?? ''} onChange={(e) => setEditing({ ...editing, fatherId: e.target.value || undefined })}><option value="">—</option>{allSims.map((s) => <option key={s.id} value={s.id}>{getFullName(s)}</option>)}</select></div>
                <div className="field-group"><label>Mother</label><select value={editing.motherId ?? ''} onChange={(e) => setEditing({ ...editing, motherId: e.target.value || undefined })}><option value="">—</option>{allSims.map((s) => <option key={s.id} value={s.id}>{getFullName(s)}</option>)}</select></div>
                <div className="field-group"><label>Spouse</label><select value={editing.spouseId ?? ''} onChange={(e) => setEditing({ ...editing, spouseId: e.target.value || undefined })}><option value="">—</option>{allSims.filter(s => s.id !== editing.id).map((s) => <option key={s.id} value={s.id}>{getFullName(s)}</option>)}</select></div>
                <div className="field-group"><label>Married Year</label><input type="number" value={editing.marriageYear ?? ''} onChange={(e) => setEditing({ ...editing, marriageYear: e.target.value ? Number(e.target.value) : undefined })} /></div>

                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {unionsForSim(editing.id).map((u) => {
                      const partnerId = u.partnerAId === editing.id ? u.partnerBId : u.partnerAId;
                      return (
                        <div key={u.id} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '0.75rem', display: 'grid', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '0.9rem' }}>{u.endYear == null ? 'Active Marriage / Partnership' : 'Past Marriage / Partnership'}</strong>
                            <span className="field-hint">{formatUnionLabel(u, editing.id)}</span>
                          </div>
                          <div className="field-group" style={{ margin: 0 }}>
                            <label>Partner</label>
                            <select value={partnerId ?? ''} onChange={(e) => onUnionsChange?.(unions.map((x) => x.id === u.id ? { ...x, partnerAId: editing.id, partnerBId: e.target.value || undefined } : x))}>
                              <option value="">—</option>
                              {allSims.filter((o) => o.id !== editing.id).map((o) => <option key={o.id} value={o.id}>{getFullName(o)}</option>)}
                            </select>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.5rem' }}>
                            <div className="field-group" style={{ margin: 0 }}><label>Start Year</label><input type="number" value={u.startYear ?? ''} onChange={(e) => onUnionsChange?.(unions.map((x) => x.id === u.id ? { ...x, startYear: e.target.value ? Number(e.target.value) : undefined } : x))} /></div>
                            <div className="field-group" style={{ margin: 0 }}><label>Start Day</label><input type="number" min={1} max={trackerConfig.daysPerYear} value={u.startDayOfYear ?? ''} onChange={(e) => onUnionsChange?.(unions.map((x) => x.id === u.id ? { ...x, startDayOfYear: e.target.value ? Number(e.target.value) : undefined } : x))} /></div>
                            <div className="field-group" style={{ margin: 0 }}><label>End Year</label><input type="number" value={u.endYear ?? ''} onChange={(e) => onUnionsChange?.(unions.map((x) => x.id === u.id ? { ...x, endYear: e.target.value ? Number(e.target.value) : undefined } : x))} /></div>
                            <div className="field-group" style={{ margin: 0 }}><label>End Day</label><input type="number" min={1} max={trackerConfig.daysPerYear} value={u.endDayOfYear ?? ''} onChange={(e) => onUnionsChange?.(unions.map((x) => x.id === u.id ? { ...x, endDayOfYear: e.target.value ? Number(e.target.value) : undefined } : x))} /></div>
                          </div>
                          <div className="field-group" style={{ margin: 0 }}>
                            <label>End Reason</label>
                            <select value={u.endReason ?? 'unknown'} onChange={(e) => onUnionsChange?.(unions.map((x) => x.id === u.id ? { ...x, endReason: e.target.value as UnionNode['endReason'] } : x))}>
                              <option value="unknown">Unknown</option>
                              <option value="divorce">Divorce</option>
                              <option value="death">Death</option>
                            </select>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="btn-ghost btn-sm btn-danger" onClick={() => onUnionsChange?.(unions.filter((x) => x.id !== u.id))}>Remove relationship</button>
                          </div>
                        </div>
                      );
                    })}

                    <button className="btn-secondary btn-sm" onClick={() => onUnionsChange?.([...(unions ?? []), { id: nanoid(), partnerAId: editing.id, partnerBId: undefined, startYear: undefined, startDayOfYear: undefined, endYear: undefined, endDayOfYear: undefined, endReason: 'unknown' }])}>+ Add Relationship</button>
                  </div>
                </div>

              </div>

              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button className="btn-ghost" onClick={onClose}>Cancel</button>
                <button className="btn-primary" onClick={() => { save(); onClose(); }}>Save</button>
              </div>
            </div>
          )}

          {tab === 'photos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>Profile Photo</div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ width: 88, height: 88, borderRadius: avatarRadius, overflow: 'hidden', border: `2px solid ${sexColor}55`, background: 'var(--color-border)', flexShrink: 0 }}>
                    {editing.avatarUrl ? <img src={editing.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: sexColor }}>{(sim.firstName?.[0] ?? '?').toUpperCase()}</div>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'inline-block', padding: '0.5rem 1rem', borderRadius: 8, background: uploading ? 'var(--color-border)' : sexColor + '22', color: sexColor, border: `1px solid ${sexColor}44`, cursor: uploading ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                      {uploading ? 'Uploading…' : '📷 Change Photo'}
                      <input type="file" accept="image/*" disabled={uploading} style={{ display: 'none' }} onChange={async e => { const file = e.target.files?.[0]; if (!file || !editing.id) return; try { setUploading(true); const res = await uploadPhoto(file, editing.id); setEditing({ ...editing, avatarUrl: res.url ?? undefined, avatarBlobKey: res.blobKey, avatarCrop: undefined }); } finally { setUploading(false); e.target.value = ''; } }} />
                    </label>
                    {editing.avatarUrl && <div style={{ marginTop: '0.75rem' }}><AvatarCropEditor imageUrl={editing.avatarUrl} value={editing.avatarCrop as any} onChange={next => setEditing({ ...editing, avatarCrop: next as any })} /></div>}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--color-border)' }} />

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Life Stage Photos</div>
                  {!isPremium && (<span style={{ padding: '0.2rem 0.6rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: 'linear-gradient(90deg,#f59e0b,#f97316)', color: '#fff' }}>✦ Premium</span>)}
                </div>

                {!isPremium ? (
                  <div style={{ padding: '1.5rem', borderRadius: 12, border: '1.5px dashed var(--color-border)', textAlign: 'center', background: 'rgba(245,158,11,0.05)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔒</div>
                    <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.25rem' }}>Life Stage Photos</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>Upload a unique photo for each life stage — Baby, Toddler, Child, Teen, and beyond.</div>
                    <button className="btn-primary" onClick={() => alert('Upgrade to premium to unlock life stage photos')}>Upgrade to Premium</button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                    {lifeStages.map(ls => {
                      const slot = editing.lifeStagePhotos?.[ls.id];
                      return (
                        <div key={ls.id} style={{ borderRadius: 10, border: '1px solid var(--color-border)', overflow: 'hidden', background: 'var(--color-surface)' }}>
                          <div style={{ height: 90, background: 'var(--color-border)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {slot?.url ? <img src={slot.url} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} /> : <span style={{ fontSize: '1.5rem', opacity: 0.4 }}>📷</span>}
                          </div>
                          <div style={{ padding: '0.5rem 0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)' }}>{ls.name}</span>
                            <label style={{ cursor: 'pointer', fontSize: '0.75rem', color: sexColor, fontWeight: 600 }}>{uploading ? '…' : 'Upload'}
                              <input type="file" accept="image/*" disabled={uploading} style={{ display: 'none' }} onChange={async e => { const file = e.target.files?.[0]; if (!file || !editing.id) return; try { setUploading(true); const res = await uploadPhoto(file, editing.id); setEditing({ ...editing, lifeStagePhotos: { ...(editing.lifeStagePhotos ?? {}), [ls.id]: { url: res.url ?? '', blobKey: res.blobKey } } }); } finally { setUploading(false); e.target.value = ''; } }} />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn-primary" onClick={() => { save(); onClose(); }}>Save</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
