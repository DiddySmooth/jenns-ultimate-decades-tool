import React, { useState } from 'react';
import type { SimEntry, FamilyTreeConfig, TrackerConfig } from '../../types/tracker';
import { getFullName, computeLifeStage } from '../../utils/lifeStage';
import AvatarCropEditor from '../sims/AvatarCropEditor';

interface Props {
  sim: SimEntry | null;
  allSims: SimEntry[];
  open: boolean;
  onClose: () => void;
  onSave: (s: SimEntry) => void;
  trackerConfig: TrackerConfig;
  treeConfig: FamilyTreeConfig;
  isPremium: boolean;
  userId: string;
  saveId: string;
  currentDay: number;
}

export default function SimDetailPanel({ sim, allSims, open, onClose, onSave, trackerConfig, treeConfig, isPremium, userId, saveId, currentDay }: Props) {
  const [tab, setTab] = useState<'overview' | 'edit' | 'photos'>('overview');
  const [editing, setEditing] = useState<SimEntry | null>(sim);
  const [uploading, setUploading] = useState(false);
  const [cropTarget, setCropTarget] = useState<string | null>(null);

  React.useEffect(() => { setEditing(sim); setTab('overview'); }, [sim]);

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

  if (!open || !sim || !editing) return null;

  const lifeStage = computeLifeStage(sim, trackerConfig, currentDay);
  const sexColor = sim.sex === 'Female' ? '#e91e8c' : sim.sex === 'Male' ? '#4a90d9' : '#888';
  const sexBg = sim.sex === 'Female' ? 'rgba(249,168,201,0.13)' : sim.sex === 'Male' ? 'rgba(147,197,253,0.13)' : 'rgba(128,128,128,0.08)';
  const avatarRadius = treeConfig.avatarShape === 'circle' ? '50%' : treeConfig.avatarShape === 'rounded' ? '14px' : '6px';

  const parents = [sim.fatherId && allSims.find(s => s.id === sim.fatherId), sim.motherId && allSims.find(s => s.id === sim.motherId)].filter(Boolean) as SimEntry[];
  const children = allSims.filter(s => s.fatherId === sim.id || s.motherId === sim.id);
  const lifeStages = trackerConfig.humanAging?.lifeStages ?? [];

  const saveChanges = () => { onSave(editing); onClose(); };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.18)', zIndex: 119, backdropFilter: 'blur(2px)' }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', right: 0, top: 0, height: '100vh', width: 480,
        background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)',
        zIndex: 120, boxShadow: '-12px 0 40px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{ background: sexBg, padding: '1.5rem 1.5rem 0', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
            {/* Avatar */}
            <div style={{
              width: 90, height: 90, borderRadius: avatarRadius, overflow: 'hidden',
              border: `3px solid ${sexColor}`, flexShrink: 0, background: 'var(--color-border)',
            }}>
              {sim.avatarUrl
                ? <img src={sim.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: sexColor, fontWeight: 700 }}>
                    {(sim.firstName?.[0] ?? '?').toUpperCase()}
                  </div>}
            </div>

            {/* Name + badges */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.2, color: 'var(--color-text)' }}>
                {getFullName(sim)}
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                {lifeStage && (
                  <span style={{ padding: '0.2rem 0.6rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, background: sexColor + '22', color: sexColor, border: `1px solid ${sexColor}55` }}>
                    {lifeStage}
                  </span>
                )}
                {sim.sex && sim.sex !== 'Unknown' && (
                  <span style={{ padding: '0.2rem 0.6rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 500, background: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                    {sim.sex}
                  </span>
                )}
                {sim.deathYear && (
                  <span style={{ padding: '0.2rem 0.6rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 500, background: 'rgba(100,100,100,0.12)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                    ✝ Deceased
                  </span>
                )}
              </div>
              {sim.birthYear && (
                <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  {sim.birthYear}{sim.deathYear ? ` – ${sim.deathYear}` : ''}
                </div>
              )}
            </div>

            <button onClick={onClose} aria-label="Close" style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 22,
              color: 'var(--color-text-muted)', padding: '0 0.25rem', lineHeight: 1, flexShrink: 0,
            }}>×</button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, marginTop: '1rem' }}>
            {(['overview', 'edit', 'photos'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: '0.6rem 0', border: 'none', cursor: 'pointer', fontSize: '0.85rem',
                fontWeight: tab === t ? 700 : 500, background: 'none',
                color: tab === t ? sexColor : 'var(--color-text-muted)',
                borderBottom: tab === t ? `2.5px solid ${sexColor}` : '2.5px solid transparent',
                transition: 'all 0.15s',
              }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>

          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                {[
                  { label: 'Born', value: sim.birthYear ?? '—' },
                  { label: 'Died', value: sim.deathYear ?? '—' },
                  { label: 'Age', value: sim.birthYear ? (sim.deathYear ? sim.deathYear - sim.birthYear : Math.floor(currentDay / trackerConfig.daysPerYear) - sim.birthYear) : '—' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ padding: '0.75rem', borderRadius: 10, background: 'var(--color-border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.2rem', color: 'var(--color-text)' }}>{String(value)}</div>
                  </div>
                ))}
              </div>

              {/* People sections */}
              {[
                { title: 'Parents', items: parents.map(p => getFullName(p)) },
                { title: 'Children', items: children.map(c => getFullName(c)) },
              ].map(({ title, items }) => (
                <div key={title}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>{title}</div>
                  {items.length === 0
                    ? <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>—</div>
                    : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        {items.map((name, i) => (
                          <div key={i} style={{ padding: '0.4rem 0.75rem', borderRadius: 8, background: 'var(--color-border)', fontSize: '0.875rem', color: 'var(--color-text)' }}>{name}</div>
                        ))}
                      </div>}
                </div>
              ))}
            </div>
          )}

          {/* ── EDIT ── */}
          {tab === 'edit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="field-group"><label>First Name</label><input value={editing.firstName} onChange={e => setEditing({ ...editing, firstName: e.target.value })} /></div>
                <div className="field-group"><label>Last Name</label><input value={editing.lastName} onChange={e => setEditing({ ...editing, lastName: e.target.value })} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="field-group"><label>Birth Year</label><input type="number" value={editing.birthYear ?? ''} onChange={e => setEditing({ ...editing, birthYear: e.target.value ? Number(e.target.value) : undefined })} /></div>
                <div className="field-group"><label>Birth Day</label><input type="number" min={1} max={trackerConfig.daysPerYear} value={editing.birthDayOfYear ?? ''} onChange={e => setEditing({ ...editing, birthDayOfYear: e.target.value ? Number(e.target.value) : undefined })} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="field-group"><label>Death Year</label><input type="number" value={editing.deathYear ?? ''} onChange={e => setEditing({ ...editing, deathYear: e.target.value ? Number(e.target.value) : undefined })} /></div>
                <div className="field-group"><label>Death Day</label><input type="number" min={1} max={trackerConfig.daysPerYear} value={editing.deathDayOfYear ?? ''} onChange={e => setEditing({ ...editing, deathDayOfYear: e.target.value ? Number(e.target.value) : undefined })} /></div>
              </div>
              <div className="field-group">
                <label>Sex</label>
                <select value={editing.sex ?? 'Unknown'} onChange={e => setEditing({ ...editing, sex: e.target.value as SimEntry['sex'] })}>
                  {['Female', 'Male', 'Intersex', 'Non-binary', 'Unknown'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button className="btn-ghost" onClick={onClose}>Cancel</button>
                <button className="btn-primary" onClick={saveChanges}>Save Changes</button>
              </div>
            </div>
          )}

          {/* ── PHOTOS ── */}
          {tab === 'photos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Default photo — available to all */}
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>Profile Photo</div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ width: 88, height: 88, borderRadius: avatarRadius, overflow: 'hidden', border: `2px solid ${sexColor}55`, background: 'var(--color-border)', flexShrink: 0 }}>
                    {editing.avatarUrl
                      ? <img src={editing.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: sexColor }}>
                          {(sim.firstName?.[0] ?? '?').toUpperCase()}
                        </div>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{
                      display: 'inline-block', padding: '0.5rem 1rem', borderRadius: 8,
                      background: uploading ? 'var(--color-border)' : sexColor + '22',
                      color: sexColor, border: `1px solid ${sexColor}44`,
                      cursor: uploading ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600,
                    }}>
                      {uploading ? 'Uploading…' : '📷 Change Photo'}
                      <input type="file" accept="image/*" disabled={uploading} style={{ display: 'none' }} onChange={async e => {
                        const file = e.target.files?.[0]; if (!file || !editing.id) return;
                        try { setUploading(true); const res = await uploadPhoto(file, editing.id); setEditing({ ...editing, avatarUrl: res.url ?? undefined, avatarBlobKey: res.blobKey, avatarCrop: undefined }); } finally { setUploading(false); }
                      }} />
                    </label>
                    {editing.avatarUrl && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <AvatarCropEditor imageUrl={editing.avatarUrl} value={editing.avatarCrop as any} onChange={next => setEditing({ ...editing, avatarCrop: next as any })} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div style={{ borderTop: '1px solid var(--color-border)' }} />

              {/* Life stage photos */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Life Stage Photos
                  </div>
                  {!isPremium && (
                    <span style={{ padding: '0.2rem 0.6rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: 'linear-gradient(90deg,#f59e0b,#f97316)', color: '#fff' }}>
                      ✦ Premium
                    </span>
                  )}
                </div>

                {!isPremium ? (
                  <div style={{ padding: '1.5rem', borderRadius: 12, border: '1.5px dashed var(--color-border)', textAlign: 'center', background: 'rgba(245,158,11,0.05)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔒</div>
                    <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.25rem' }}>Life Stage Photos</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                      Upload a unique photo for each life stage — Baby, Toddler, Child, Teen, and beyond.
                    </div>
                    <button className="btn-primary" onClick={() => alert('Upgrade to premium to unlock life stage photos')}>
                      Upgrade to Premium
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                    {lifeStages.map(ls => {
                      const slot = editing.lifeStagePhotos?.[ls.id];
                      return (
                        <div key={ls.id} style={{ borderRadius: 10, border: '1px solid var(--color-border)', overflow: 'hidden', background: 'var(--color-surface)' }}>
                          <div style={{ height: 90, background: 'var(--color-border)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {slot?.url
                              ? <img src={slot.url} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                              : <span style={{ fontSize: '1.5rem', opacity: 0.4 }}>📷</span>}
                          </div>
                          <div style={{ padding: '0.5rem 0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)' }}>{ls.name}</span>
                            <label style={{ cursor: 'pointer', fontSize: '0.75rem', color: sexColor, fontWeight: 600 }}>
                              {uploading ? '…' : 'Upload'}
                              <input type="file" accept="image/*" disabled={uploading} style={{ display: 'none' }} onChange={async e => {
                                const file = e.target.files?.[0]; if (!file || !editing.id) return;
                                try { setUploading(true); const res = await uploadPhoto(file, editing.id); setEditing({ ...editing, lifeStagePhotos: { ...(editing.lifeStagePhotos ?? {}), [ls.id]: { url: res.url ?? '', blobKey: res.blobKey } } }); } finally { setUploading(false); }
                              }} />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Save photos */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn-primary" onClick={saveChanges}>Save</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
