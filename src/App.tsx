import { useEffect, useRef, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import SetupWizard from './components/setup/SetupWizard';
import TimelineView from './components/timeline/TimelineView';
import SimsSheet from './components/sims/SimsSheet';
import AgingReference from './components/aging/AgingReference';
import type { TrackerSave, SimEntry, TimelineEvent } from './types/tracker';

type Tab = 'timeline' | 'sims' | 'aging';

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
  const btnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user || !btnRef.current) return;

    const init = () => {
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response: any) => {
          const decoded = jwtDecode<GoogleUser>(response.credential);
          localStorage.setItem(AUTH_KEY, JSON.stringify(decoded));
          setUser(decoded);
        },
      });
      google.accounts.id.renderButton(btnRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        width: 280,
      });
    };

    if (typeof google !== 'undefined') {
      init();
    } else {
      // Wait for script to load
      const interval = setInterval(() => {
        if (typeof google !== 'undefined') {
          clearInterval(interval);
          init();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [user, btnRef.current]);

  const signOut = () => {
    localStorage.removeItem(AUTH_KEY);
    setUser(null);
  };

  return { user, loading, btnRef, signOut };
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
  } catch {
    return null;
  }
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
  const { user, loading, btnRef, signOut } = useAuth();
  const [save, setSave] = useState<TrackerSave | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('timeline');

  useEffect(() => {
    if (!user) return;
    setSaveLoading(true);
    loadSave(user.sub).then((s) => {
      setSave(s);
      setSaveLoading(false);
    });
  }, [user]);

  const updateSave = (updated: TrackerSave) => {
    setSave(updated);
    persistSave(updated, user!.sub);
  };

  const handleWizardComplete = (newSave: TrackerSave) => {
    updateSave(newSave);
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

  const addSim = (sim: SimEntry) => {
    if (!save) return;
    updateSave({ ...save, sims: [...save.sims, sim] });
  };

  const updateSim = (sim: SimEntry) => {
    if (!save) return;
    updateSave({ ...save, sims: save.sims.map((s) => (s.id === sim.id ? sim : s)) });
  };

  const deleteSim = (id: string) => {
    if (!save) return;
    updateSave({ ...save, sims: save.sims.filter((s) => s.id !== id) });
  };

  if (loading || saveLoading) {
    return (
      <div className="loading-screen">
        <p>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1>Jenn's Ultimate Decades Tool</h1>
          <p>Track your Sims 4 Decades Challenge — generations, timeline, family history, and more.</p>
          <div ref={btnRef} className="google-btn-wrapper" />
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
        <SetupWizard onComplete={handleWizardComplete} />
      </div>
    );
  }

  const allAgingConfigs = [save.config.humanAging, ...save.config.pets, ...save.config.occults];

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <h1 className="app-title">JUDT</h1>
          <span className="challenge-meta">
            Started {save.config.startYear} · Day {save.currentDay}
          </span>
          <span className="user-info">{user.email}</span>
          <button className="btn-ghost btn-sm" onClick={signOut}>Sign out</button>
        </div>
        <nav className="tab-nav">
          <button className={tab === 'timeline' ? 'active' : ''} onClick={() => setTab('timeline')}>Timeline</button>
          <button className={tab === 'sims' ? 'active' : ''} onClick={() => setTab('sims')}>Sims</button>
          <button className={tab === 'aging' ? 'active' : ''} onClick={() => setTab('aging')}>Aging</button>
        </nav>
      </header>

      <main className="app-main">
        {tab === 'timeline' && (
          <TimelineView
            timeline={save.timeline}
            currentDay={save.currentDay}
            onMarkDay={markDay}
            onAddEvent={addEvent}
          />
        )}
        {tab === 'sims' && (
          <SimsSheet
            sims={save.sims}
            config={save.config}
            onAdd={addSim}
            onUpdate={updateSim}
            onDelete={deleteSim}
          />
        )}
        {tab === 'aging' && (
          <AgingReference configs={allAgingConfigs} />
        )}
      </main>
    </div>
  );
}
