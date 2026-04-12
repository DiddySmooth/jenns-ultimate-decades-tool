import { useCallback, useEffect, useRef, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import { nanoid } from 'nanoid';
import SetupWizard from './components/setup/SetupWizard';
import TimelineView from './components/timeline/TimelineView';
import SimsSheet from './components/sims/SimsSheet';
import PregnancyTracker from './components/pregnancy/PregnancyTracker';
import FamilyTree from './components/familyTree/FamilyTree';
import AgingReference from './components/aging/AgingReference';
import ThemePicker from './components/ThemePicker';
import Toast from './components/Toast';
import ColumnLabelEditor from './components/ColumnLabelEditor';
import { useDebouncedSave } from './hooks/useDebouncedSave';
import { useTheme } from './hooks/useTheme';
import type { TrackerSave, SimEntry, TimelineEvent } from './types/tracker';

type Tab = 'timeline' | 'sims' | 'pregnancy' | 'tree' | 'aging' | 'settings';

const GOOGLE_CLIENT_ID = '106970576831-dbrfg4aqshbcqpq9m6fi3sr2itg0v4a6.apps.googleusercontent.com';
const DEV_STORAGE_KEY = 'judt_dev_save';
const AUTH_KEY = 'judt_user';

type GoogleAccounts = {
  id: {
    initialize: (opts: { client_id: string; callback: (response: { credential: string }) => void }) => void;
    prompt: () => void;
  };
};

declare const google: { accounts: GoogleAccounts } | undefined;

interface GoogleUser {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

function useAuth() {
  const [user, setUser] = useState<GoogleUser | null>(() => {
    const stored = localStorage.getItem(AUTH_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  const [googleReady, setGoogleReady] = useState(false);

  const loading = false;

  useEffect(() => {
    if (user) return;
    const check = () => {
      if (typeof google !== 'undefined' && google.accounts) {
        setGoogleReady(true);
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response: { credential: string }) => {
            const decoded = jwtDecode<GoogleUser>(response.credential);
            localStorage.setItem(AUTH_KEY, JSON.stringify(decoded));
            setUser(decoded);
          },
        });
      } else {
        setTimeout(check, 150);
      }
    };
    check();
  }, [user]);

  const signIn = () => { if (google) google.accounts.id.prompt(); };
  const signOut = () => { localStorage.removeItem(AUTH_KEY); setUser(null); };

  return { user, loading, googleReady, signIn, signOut };
}

async function loadSave(userId: string, saveId: string): Promise<TrackerSave | null> {
  if (import.meta.env.DEV) {
    const raw = localStorage.getItem(`${DEV_STORAGE_KEY}:${saveId}`);
    return raw ? JSON.parse(raw) : null;
  }
  try {
    const r = await fetch(`/api/getSave?userId=${userId}&saveId=${encodeURIComponent(saveId)}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('Failed to load save');
    return r.json();
  } catch { return null; }
}

async function persistSave(save: TrackerSave, userId: string, saveId: string): Promise<void> {
  if (import.meta.env.DEV) {
    localStorage.setItem(`${DEV_STORAGE_KEY}:${saveId}`, JSON.stringify(save));
    return;
  }
  await fetch(`/api/putSave?userId=${userId}&saveId=${encodeURIComponent(saveId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(save),
  });
}

export default function App() {
  const { user, loading, googleReady, signIn, signOut } = useAuth();
  const { themeId, setThemeId } = useTheme();

  const [saveId, setSaveId] = useState(() => localStorage.getItem('judt_saveId') ?? 'default');
  const [availableSaves, setAvailableSaves] = useState<{ id: string; label: string }[]>([{ id: 'default', label: 'Default' }]);

  const [save, setSave] = useState<TrackerSave | null>(null);
  // Mutable ref mirrors save — cell edits write here directly (zero re-render)
  // React state is only updated for save scheduling and non-timeline changes
  const saveRef = useRef<TrackerSave | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [tab, setTab] = useState<Tab>(() => {
    const stored = localStorage.getItem('judt_tab') as Tab | null;
    return stored ?? 'timeline';
  });

  useEffect(() => {
    localStorage.setItem('judt_tab', tab);
  }, [tab]);

  // Build a stable persist function bound to the current user
  const persistFn = useCallback(
    (s: TrackerSave) => persistSave(s, user?.sub ?? '', saveId),
    [user?.sub, saveId]
  );
  const { schedule, flush, saving } = useDebouncedSave(persistFn);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const wasSavingRef = useRef(false);

  // Pop a small toast only when we transition from saving -> not saving
  useEffect(() => {
    if (wasSavingRef.current && !saving) {
      setShowSavedToast(true);
    }
    wasSavingRef.current = saving;
  }, [saving]);

  useEffect(() => {
    localStorage.setItem('judt_saveId', saveId);
  }, [saveId]);

  async function refreshSaveList(userId: string) {
    try {
      const r = await fetch(`/api/listSaves?userId=${userId}`);
      if (!r.ok) throw new Error('failed');
      const data = await r.json();
      const ids: { id: string; label: string }[] = [];

      for (const s of data.saves ?? []) {
        const key: string = s.key;
        // userId/saves/<id>.json
        const m = key.match(/\/saves\/(.+)\.json$/);
        if (m) ids.push({ id: m[1], label: m[1] });
        // legacy userId/tracker.json
        if (key.endsWith('/tracker.json')) ids.push({ id: 'default', label: 'Default' });
      }

      const unique = new Map(ids.map((x) => [x.id, x]));
      if (!unique.has('default')) unique.set('default', { id: 'default', label: 'Default' });
      setAvailableSaves(Array.from(unique.values()));
    } catch {
      setAvailableSaves([{ id: 'default', label: 'Default' }]);
    }
  }

  useEffect(() => {
    if (!user) return;
    refreshSaveList(user.sub);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setSaveLoading(true);
    loadSave(user.sub, saveId).then((s) => {
      const normalized = s
        ? {
            ...s,
            pregnancyCouples: s.pregnancyCouples ?? [],
            unions: s.unions ?? [],
            familyTree: s.familyTree ?? { nodes: [], edges: [] },
            familyTreeConfig: s.familyTreeConfig ?? {
              avatarShape: 'circle',
              display: {
                showBirthYear: true,
                showDeathYear: true,
                showAge: true,
                showLifeStage: true,
                showGeneration: true,
              },
              filters: {
                hiddenLifeStages: [],
                hideDeadSims: false,
                hideDeadBranches: false,
              },
            },
          }
        : s;
      setSave(normalized);
      saveRef.current = normalized;
      // Update dropdown label from the tracker name (if present)
      if (s?.config?.name) {
        setAvailableSaves((prev) => prev.map((x) => (x.id === saveId ? { ...x, label: s.config.name } : x)));
      }
      setSaveLoading(false);
    });
  }, [user, saveId]);

  // Full state update (triggers re-render) — for structural changes
  const updateSave = (updated: TrackerSave) => {
    saveRef.current = updated;
    setSave(updated);
    schedule(updated);
  };

  // Cell update — mutates ref directly, schedules save, NO re-render
  const updateCell = useCallback((dayNumber: number, field: string, value: string) => {
    const current = saveRef.current;
    if (!current) return;
    const day = current.timeline[dayNumber - 1];
    if (!day) return;
    let updatedDay;
    if (field === 'deaths') updatedDay = { ...day, deaths: value };
    else updatedDay = { ...day, lifeStageCells: { ...day.lifeStageCells, [field]: value } };
    // Mutate the timeline array in-place on the ref (no new array, no re-render)
    const newTimeline = current.timeline.slice();
    newTimeline[dayNumber - 1] = updatedDay;
    const updated = { ...current, timeline: newTimeline };
    saveRef.current = updated;
    schedule(updated); // debounced blob write only
  }, [schedule]);

  const markDay = (dayNumber: number) => {
    const current = saveRef.current;
    if (!current) return;

    // New UX:
    // - Clicking a future day sets that day as the CURRENT day (no auto-marking).
    // - Clicking the current day completes it and advances.
    // - Clicking a past day rewinds (undo) back to that day.

    if (dayNumber > current.currentDay) {
      // Jump forward to a new current day without marking intermediate days
      updateSave({ ...current, currentDay: dayNumber });
      return;
    }

    const rewinding = dayNumber < current.currentDay;
    if (rewinding) {
      const timeline = current.timeline.map((d) => ({
        ...d,
        marked: d.dayNumber < dayNumber,
      }));
      updateSave({ ...current, timeline, currentDay: dayNumber });
      return;
    }

    // Completing current day
    const nextCurrent = current.currentDay + 1;
    const timeline = current.timeline.map((d) => ({
      ...d,
      marked: d.dayNumber < nextCurrent,
    }));
    updateSave({ ...current, timeline, currentDay: nextCurrent });
  };

  const addEvent = (dayNumber: number, event: TimelineEvent) => {
    const current = saveRef.current;
    if (!current) return;
    const timeline = current.timeline.map((d) =>
      d.dayNumber === dayNumber ? { ...d, events: [...d.events, event] } : d
    );
    updateSave({ ...current, timeline });
  };

  const addCustomColumn = (label: string) => {
    const current = saveRef.current;
    if (!current) return;
    updateSave({
      ...current,
      config: {
        ...current.config,
        customColumns: [...(current.config.customColumns ?? []), { id: nanoid(), label }],
      },
    });
  };

  const addSim = (sim: SimEntry) => { const c = saveRef.current; if (c) updateSave({ ...c, sims: [...c.sims, sim] }); };
  const updateSim = (sim: SimEntry) => { const c = saveRef.current; if (c) updateSave({ ...c, sims: c.sims.map((s) => s.id === sim.id ? sim : s) }); };
  const deleteSim = (id: string) => { const c = saveRef.current; if (c) updateSave({ ...c, sims: c.sims.filter((s) => s.id !== id) }); };

  if (loading || saveLoading) {
    return <div className="loading-screen"><p>Loading…</p></div>;
  }

  if (!user) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1>Jenn's Ultimate Decades Tool</h1>
          <p>Track your Sims 4 Decades Challenge — generations, timeline, family history, and more.</p>
          <button className="btn-google" onClick={signIn} disabled={!googleReady}>
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  if (!save) {
    return (
      <div className="setup-screen">
        <div className="setup-header">
          <h1>Jenn's Ultimate Decades Tool</h1>
          <p>Let's set up your tracker.</p>
        </div>
        <SetupWizard onComplete={(s) => { saveRef.current = s; updateSave(s); }} />
      </div>
    );
  }

  const allAgingConfigs = [save.config.humanAging, ...save.config.pets, ...save.config.occults];

  return (
    <div className="app">
      <Toast message="Saved" open={showSavedToast} onClose={() => setShowSavedToast(false)} />
      <header className="app-header">
        <div className="app-header-inner">
          <h1 className="app-title">JUDT</h1>
          <span className="challenge-meta">
            Started {save.config.startYear} · Current Day {save.currentDay}
          </span>
          <span className="save-status">{saving ? 'Saving…' : '✓ Saved'}</span>

          <div className="save-switcher">
            <select
              className="save-select"
              value={saveId}
              onChange={(e) => setSaveId(e.target.value)}
              title="Switch tracker"
            >
              {availableSaves.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <button
              className="btn-secondary btn-sm"
              onClick={() => {
                const id = `tracker-${new Date().toISOString().slice(0,10)}-${Math.random().toString(16).slice(2,6)}`;
                setAvailableSaves((s) => (s.find((x) => x.id === id) ? s : [...s, { id, label: 'New Tracker' }]));
                setSaveId(id);
                saveRef.current = null;
                setSave(null);
              }}
              title="Create a new tracker"
            >
              + New Tracker
            </button>
          </div>

          <ThemePicker current={themeId} onChange={setThemeId} compact />
          <span className="user-info">{user.email}</span>
          <button className="btn-ghost btn-sm" onClick={() => { flush(); signOut(); }}>Sign out</button>
        </div>
        <nav className="tab-nav">
          <button className={tab === 'timeline' ? 'active' : ''} onClick={() => setTab('timeline')}>Timeline</button>
          <button className={tab === 'sims' ? 'active' : ''} onClick={() => setTab('sims')}>Sims</button>
          <button className={tab === 'pregnancy' ? 'active' : ''} onClick={() => setTab('pregnancy')}>Marriage/Pregnancy</button>
          <button className={tab === 'tree' ? 'active' : ''} onClick={() => setTab('tree')}>Family Tree</button>
          <button className={tab === 'aging' ? 'active' : ''} onClick={() => setTab('aging')}>Aging</button>
          <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>Settings</button>
        </nav>
      </header>

      <main className="app-main">
        {tab === 'timeline' && (
          <TimelineView
            timeline={save.timeline}
            config={save.config}
            currentDay={save.currentDay}
            onMarkDay={markDay}
            onNextDay={() => markDay(save.currentDay)}
            onAddEvent={addEvent}
            onRemoveEvent={(dayNumber, eventId) => {
              const current = saveRef.current;
              if (!current) return;
              const timeline = current.timeline.map((d) => {
                if (d.dayNumber !== dayNumber) return d;
                return { ...d, events: (d.events ?? []).filter((ev) => ev.id !== eventId) };
              });
              updateSave({ ...current, timeline });
            }}
            onUpdateCell={updateCell}
            onAddCustomColumn={addCustomColumn}
          />
        )}
        {tab === 'sims' && (
          <SimsSheet
            sims={save.sims}
            config={save.config}
            currentDay={save.currentDay}
            userId={user.sub}
            saveId={saveId}
            onAdd={addSim}
            onUpdate={updateSim}
            onDelete={deleteSim}
            onReorder={(next) => {
              const current = saveRef.current;
              if (!current) return;
              updateSave({ ...current, sims: next });
            }}
          />
        )}
        {tab === 'pregnancy' && (
          <PregnancyTracker
            sims={save.sims}
            couples={save.pregnancyCouples ?? []}
            onChange={(next) => {
              const current = saveRef.current;
              if (!current) return;
              updateSave({ ...current, pregnancyCouples: next });
            }}
          />
        )}
        {tab === 'tree' && (
          <FamilyTree
            sims={save.sims}
            unions={save.unions ?? []}
            saved={save.familyTree}
            config={save.familyTreeConfig}
            trackerConfig={save.config}
            currentDay={save.currentDay}
            onSavedChange={(next) => {
              const current = saveRef.current;
              if (!current) return;
              updateSave({ ...current, familyTree: next });
            }}
            onConfigChange={(next) => {
              const current = saveRef.current;
              if (!current) return;
              updateSave({ ...current, familyTreeConfig: next });
            }}
            onUnionsChange={(next) => {
              const current = saveRef.current;
              if (!current) return;
              updateSave({ ...current, unions: next });
            }}
            onSimsChange={(next) => {
              const current = saveRef.current;
              if (!current) return;
              updateSave({ ...current, sims: next });
            }}
          />
        )}
        {tab === 'aging' && (
          <AgingReference configs={allAgingConfigs} />
        )}
        {tab === 'settings' && (
          <div className="settings-page">
            <h2>Settings</h2>

            <section className="settings-section">
              <h3>Tracker</h3>
              <div className="field-group">
                <label>Tracker Name</label>
                <input
                  type="text"
                  value={save.config.name}
                  onChange={(e) => {
                    const current = saveRef.current;
                    if (!current) return;
                    const name = e.target.value;
                    const updated = { ...current, config: { ...current.config, name } };
                    updateSave(updated);
                    setAvailableSaves((prev) => prev.map((x) => (x.id === saveId ? { ...x, label: name || x.id } : x)));
                  }}
                />
              </div>
            </section>

            <section className="settings-section">
              <h3>Timeline Columns</h3>
              <ColumnLabelEditor
                config={save.config}
                onRename={(scope, newLabel) => {
                  const current = saveRef.current;
                  if (!current) return;

                  if (scope.kind === 'human') {
                    const humanAging = {
                      ...current.config.humanAging,
                      lifeStages: current.config.humanAging.lifeStages.map((ls) =>
                        ls.id === scope.stageId ? { ...ls, name: newLabel } : ls
                      ),
                    };
                    updateSave({
                      ...current,
                      config: { ...current.config, humanAging },
                    });
                    return;
                  }

                  if (scope.kind === 'pet') {
                    const pets = current.config.pets.map((pet) => {
                      if (String(pet.type) !== String(scope.type)) return pet;
                      return {
                        ...pet,
                        lifeStages: pet.lifeStages.map((ls) =>
                          ls.id === scope.stageId ? { ...ls, name: newLabel } : ls
                        ),
                      };
                    });
                    updateSave({
                      ...current,
                      config: { ...current.config, pets },
                    });
                  }
                }}
              />
            </section>

            <section className="settings-section">
              <h3>Account</h3>
              <p className="settings-meta">Signed in as <strong>{user.email}</strong></p>
              <button className="btn-secondary" onClick={() => { flush(); signOut(); }}>Sign out</button>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
