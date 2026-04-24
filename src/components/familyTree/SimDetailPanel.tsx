import React, { useState } from 'react';
import type { SimEntry, FamilyTreeConfig, TrackerConfig } from '../../types/tracker';
import { getFullName } from '../../utils/lifeStage';
import AvatarCropEditor from '../sims/AvatarCropEditor';

interface Props {
  sim: SimEntry | null;
  open: boolean;
  onClose: () => void;
  onSave: (s: SimEntry) => void;
  trackerConfig: TrackerConfig;
  treeConfig: FamilyTreeConfig;
  isPremium: boolean;
  userId: string;
  saveId: string;
}

export default function SimDetailPanel({ sim, open, onClose, onSave, trackerConfig, treeConfig, isPremium, userId, saveId }: Props) {
  const [tab, setTab] = useState<'overview'|'edit'|'photos'>('overview');
  const [editing, setEditing] = useState<SimEntry | null>(sim);
  const [uploading, setUploading] = useState(false);

  React.useEffect(() => setEditing(sim), [sim]);

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
      body: JSON.stringify({ simId, mimeType: file.type, dataBase64 }),
    });

    if (!r.ok) throw new Error('Upload failed');
    return r.json() as Promise<{ blobKey: string; url: string | null }>;
  }

  const lifeStage = undefined;

  if (!open || !sim) return null;

  const saveChanges = () => { if (!editing) return; onSave(editing); onClose(); };

  return (
    <div style={{ position: 'fixed', right: 0, top: 0, height: '100vh', width: 380, background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)', zIndex: 120, transition: 'transform 280ms ease', boxShadow: '-8px 0 16px rgba(0,0,0,0.08)', padding: '1rem', overflowY: 'auto' }}>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{ width: 160, height: 160, borderRadius: treeConfig.avatarShape === 'circle' ? '50%' : treeConfig.avatarShape === 'rounded' ? '12px' : '4px', overflow: 'hidden', background: 'var(--color-border)' }}>
          {sim.avatarUrl ? <img src={sim.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>—</div>}
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0 }}>{getFullName(sim)}</h2>
          <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ padding: '0.25rem 0.5rem', borderRadius: '999px', border: '1px solid var(--color-border)', background: 'transparent' }}>{sim.currentLifeStage ?? lifeStage ?? '—'}</span>
          </div>
        </div>
        <button className="btn-ghost" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.4rem' }}>
        <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Overview</button>
        <button className={tab === 'edit' ? 'active' : ''} onClick={() => setTab('edit')}>Edit</button>
        <button className={tab === 'photos' ? 'active' : ''} onClick={() => setTab('photos')}>Photos</button>
      </div>

      <div style={{ marginTop: '1rem' }}>
        {tab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div><strong>Born</strong><div>{sim.birthYear ?? '—'}</div></div>
              <div><strong>Died</strong><div>{sim.deathYear ?? '—'}</div></div>
              <div><strong>Age</strong><div>{(sim.birthYear && sim.deathYear) ? String((sim.deathYear - sim.birthYear)) : (sim.birthYear ? String(new Date().getFullYear() - sim.birthYear) : '—')}</div></div>
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <strong>Parents</strong>
              <div>{sim.fatherId ?? '—'} / {sim.motherId ?? '—'}</div>
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <strong>Partners</strong>
              <div>{sim.spouseId ?? '—'}</div>
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <strong>Children</strong>
              <div>—</div>
            </div>
          </div>
        )}

        {tab === 'edit' && editing && (
          <div>
            <div className="field-group"><label>First Name</label><input value={editing.firstName} onChange={(e) => setEditing({ ...editing, firstName: e.target.value })} /></div>
            <div className="field-group"><label>Last Name</label><input value={editing.lastName} onChange={(e) => setEditing({ ...editing, lastName: e.target.value })} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
              <div className="field-group"><label>Birth Year</label><input type="number" value={editing.birthYear ?? ''} onChange={(e) => setEditing({ ...editing, birthYear: e.target.value ? Number(e.target.value) : undefined })} /></div>
              <div className="field-group"><label>Birth Day</label><input type="number" min={1} max={trackerConfig.daysPerYear} value={editing.birthDayOfYear ?? ''} onChange={(e) => setEditing({ ...editing, birthDayOfYear: e.target.value ? Number(e.target.value) : undefined })} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
              <div className="field-group"><label>Death Year</label><input type="number" value={editing.deathYear ?? ''} onChange={(e) => setEditing({ ...editing, deathYear: e.target.value ? Number(e.target.value) : undefined })} /></div>
              <div className="field-group"><label>Death Day</label><input type="number" min={1} max={trackerConfig.daysPerYear} value={editing.deathDayOfYear ?? ''} onChange={(e) => setEditing({ ...editing, deathDayOfYear: e.target.value ? Number(e.target.value) : undefined })} /></div>
            </div>
            <div className="field-group"><label>Sex</label><select value={editing.sex ?? 'Unknown'} onChange={(e) => setEditing({ ...editing, sex: e.target.value as any })}><option>Female</option><option>Male</option><option>Intersex</option><option>Non-binary</option><option>Unknown</option></select></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn-primary" onClick={saveChanges}>Save</button>
            </div>
          </div>
        )}

        {tab === 'photos' && editing && (
          <div>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Default Photo</strong>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                <div style={{ width: 96, height: 96, overflow: 'hidden', borderRadius: treeConfig.avatarShape === 'circle' ? '50%' : '8px', background: 'var(--color-border)' }}>
                  {editing.avatarUrl ? <img src={editing.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>—</div>}
                </div>
                <div>
                  <input type="file" accept="image/*" disabled={uploading} onChange={async (e) => {
                    const file = e.target.files?.[0]; if (!file || !editing.id) return; try { setUploading(true); const res = await uploadAvatar(file, editing.id); setEditing({ ...editing, avatarUrl: res.url ?? undefined, avatarBlobKey: res.blobKey, avatarCrop: undefined }); } finally { setUploading(false); }
                  }} />
                  <div style={{ marginTop: '0.5rem' }}>
                    <AvatarCropEditor imageUrl={editing.avatarUrl} value={editing.avatarCrop as any} onChange={(next) => setEditing({ ...editing, avatarCrop: next as any })} />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <strong>Life Stage Photos</strong>
              {!isPremium && <div style={{ marginTop: '0.5rem', padding: '0.5rem', border: '1px dashed var(--color-border)', borderRadius: '6px' }}>Life stage photos are a premium feature. <button className="btn-primary" onClick={() => alert('Upgrade flow...')}>Upgrade</button></div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginTop: '0.5rem' }}>
                {trackerConfig.humanAging.lifeStages.map((ls) => {
                  const slot = editing.lifeStagePhotos?.[ls.id];
                  return (
                    <div key={ls.id} style={{ border: '1px solid var(--color-border)', borderRadius: '6px', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                      <div style={{ width: '100%', height: 80, background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {slot?.url ? <img src={slot.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ color: 'var(--color-text-muted)' }}>No photo</div>}
                      </div>
                      <div style={{ width: '100%', display: 'flex', gap: '0.5rem' }}>
                        <input type="file" accept="image/*" disabled={uploading || !isPremium} onChange={async (e) => {
                          if (!isPremium) return; const file = e.target.files?.[0]; if (!file || !editing.id) return; try { setUploading(true); const res = await uploadAvatar(file, editing.id); const next = { ...editing, lifeStagePhotos: { ...(editing.lifeStagePhotos ?? {}), [ls.id]: { url: res.url ?? '', blobKey: res.blobKey } } }; setEditing(next); } finally { setUploading(false); }
                        }} />
                        {!isPremium && <button className="btn-ghost" onClick={() => alert('Upgrade to premium to unlock life stage photos')}>🔒</button>}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{ls.name}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
