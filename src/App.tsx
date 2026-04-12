import { useEffect, useState } from 'react';
import SetupWizard from './components/setup/SetupWizard';
import TimelineView from './components/timeline/TimelineView';
import SimsSheet from './components/sims/SimsSheet';
import AgingReference from './components/aging/AgingReference';
import type { TrackerSave, SimEntry, TimelineEvent } from './types/tracker';

type Tab = 'timeline' | 'sims' | 'aging';

interface AuthUser {
  userId: string;
  userDetails: string;
  identityProvider: string;
}

function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/.auth/me')
      .then((r) => r.json())
      .then((data) => {
        const principal = data?.clientPrincipal;
        if (principal) setUser(principal);
      })
      .catch(() => {
        // In local dev, auth isn't available — use a mock user
        if (import.meta.env.DEV) {
          setUser({ userId: 'dev-user', userDetails: 'dev@local', identityProvider: 'dev' });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return { user, loading };
}

async function loadSave(userId: string): Promise<TrackerSave | null> {
  try {
    const r = await fetch(`/api/getSave?userId=${userId}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('Failed to load save');
    return r.json();
  } catch {
    return null;
  }
}

async function persistSave(save: TrackerSave): Promise<void> {
  await fetch('/api/putSave', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(save),
  });
}

export default function App() {
  const { user, loading } = useAuth();
  const [save, setSave] = useState<TrackerSave | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('timeline');

  useEffect(() => {
    if (!user) return;
    setSaveLoading(true);
    loadSave(user.userId).then((s) => {
      setSave(s);
      setSaveLoading(false);
    });
  }, [user]);

  const updateSave = (updated: TrackerSave) => {
    setSave(updated);
    persistSave(updated);
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
          <a href="/.auth/login/google" className="btn-primary">
            Sign in with Google
          </a>
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
          <span className="user-info">{user.userDetails}</span>
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
