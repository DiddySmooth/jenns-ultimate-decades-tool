import { useCallback, useEffect, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import { nanoid } from 'nanoid';
import SetupWizard from './components/setup/SetupWizard';
import TimelineView from './components/timeline/TimelineView';
import SimsSheet from './components/sims/SimsSheet';
import AgingReference from './components/aging/AgingReference';
import ThemePicker from './components/ThemePicker';
import { useDebouncedSave } from './hooks/useDebouncedSave';
import { useTheme } from './hooks/useTheme';
import type { TrackerSave, SimEntry, TimelineEvent } from './types/tracker';

type Tab = 'timeline' | 'sims' | 'aging' | 'settings';

const GOOGLE_CLIENT_ID = '106970576831-dbrfg4aqshbcqpq9m6fi3sr2itg0v4a6.apps.googleusercontent.com';
const DEV_STORAGE_KEY = 'judt_dev_save';
const AUTH_KEY = 'judt_user';

declare const google: any;

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
  const [loading, setLoading] = useState(true);
  const [googleReady, setGoogleReady] = useState(false);

  useEffect(() => { setLoading(false); }, []);

  useEffect(() => {
    if (user) return;
    const check = () => {
      if (typeof google !== 'undefined' && google.accounts) {
        setGoogleReady(true);
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response: any) => {
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

  const signIn = () => { if (typeof google !== 'undefined') google.accounts.id.prompt(); };
  const signOut = () => { localStorage.removeItem(AUTH_KEY); setUser(null); };

  return { user, loading, googleReady, signIn, signOut };
}

async function loadSave(userId: string): Promise<TrackerSave | null> {
  if (import.meta.env.DEV) {
    const raw = localStorage.getItem(DEV_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }
  try {
    const r = await fetch(`/api/getSave?userId=${userId}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('Failed to load save');
    return r.json();
  } catch { return null; }
}

async function persistSave(save: TrackerSave, userId: string): Promise<void> {
  if (import.meta.env.DEV) {
    localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(save));
    return;
  }
  await fetch(`/api/putSave?userId=${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(save),
  });
}

export default function App() {
  const { user, loading, googleReady, signIn, signOut } = useAuth();
  const { themeId, setThemeId } = useTheme();
  const [save, setSave] = useState<TrackerSave | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('timeline');

  // Build a stable persist function bound to the current user
  const persistFn = useCallback(
    (s: TrackerSave) => persistSave(s, user?.sub ?? ''),
    [user?.sub]
  );
  const { schedule, flush, saving } = useDebouncedSave(persistFn);

  useEffect(() => {
    if (!user) return;
    setSaveLoading(true);
    loadSave(user.sub).then((s) => { setSave(s); setSaveLoading(false); });
  }, [user]);

  // Update state instantly, schedule debounced blob write
  const updateSave = (updated: TrackerSave) => {
    setSave(updated);
    schedule(updated);
  };

  const markDay = (dayNumber: number) => {
    if (!save) return;
    const timeline = save.timeline.map((d) =>
      d.dayNumber <= dayNumber ? { ...d, marked: true } : d
    );
    updateSave({ ...save, timeline, currentDay: dayNumber + 1 });
  };

  const addEvent = (dayNumber: number, event: TimelineEvent) => {
    if (!save) return;
    const timeline = save.timeline.map((d) =>
      d.dayNumber === dayNumber ? { ...d, events: [...d.events, event] } : d
    );
    updateSave({ ...save, timeline });
  };

  const updateCell = (dayNumber: number, field: string, value: string) => {
    if (!save) return;
    const timeline = save.timeline.map((d) => {
      if (d.dayNumber !== dayNumber) return d;
      if (field === 'deaths') return { ...d, deaths: value };
      if (field === 'births') return { ...d, births: value };
      return { ...d, lifeStageCells: { ...d.lifeStageCells, [field]: value } };
    });
    updateSave({ ...save, timeline });
  };

  const addCustomColumn = (label: string) => {
    if (!save) return;
    updateSave({
      ...save,
      config: {
        ...save.config,
        customColumns: [...(save.config.customColumns ?? []), { id: nanoid(), label }],
      },
    });
  };

  const addSim = (sim: SimEntry) => { if (save) updateSave({ ...save, sims: [...save.sims, sim] }); };
  const updateSim = (sim: SimEntry) => { if (save) updateSave({ ...save, sims: save.sims.map((s) => s.id === sim.id ? sim : s) }); };
  const deleteSim = (id: string) => { if (save) updateSave({ ...save, sims: save.sims.filter((s) => s.id !== id) }); };

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
        <SetupWizard onComplete={(s) => updateSave(s)} />
      </div>
    );
  }

  const allAgingConfigs = [save.config.humanAging, ...save.config.pets, ...save.config.occults];

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <h1 className="app-title">JUDT</h1>
          <span className="challenge-meta">Started {save.config.startYear} · Day {save.currentDay}</span>
          <span className="save-status">{saving ? 'Saving…' : '✓ Saved'}</span>
          <span className="user-info">{user.email}</span>
          <button className="btn-ghost btn-sm" onClick={() => { flush(); signOut(); }}>Sign out</button>
        </div>
        <nav className="tab-nav">
          <button className={tab === 'timeline' ? 'active' : ''} onClick={() => setTab('timeline')}>Timeline</button>
          <button className={tab === 'sims' ? 'active' : ''} onClick={() => setTab('sims')}>Sims</button>
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
            onAddEvent={addEvent}
            onUpdateCell={updateCell}
            onAddCustomColumn={addCustomColumn}
          />
        )}
        {tab === 'sims' && (
          <SimsSheet sims={save.sims} config={save.config} onAdd={addSim} onUpdate={updateSim} onDelete={deleteSim} />
        )}
        {tab === 'aging' && (
          <AgingReference configs={allAgingConfigs} />
        )}
        {tab === 'settings' && (
          <div className="settings-page">
            <h2>Settings</h2>
            <section className="settings-section">
              <h3>Appearance</h3>
              <ThemePicker current={themeId} onChange={setThemeId} />
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
