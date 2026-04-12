import type { AgingConfig, LifeStage } from '../../types/tracker';
import { simDaysToYears } from '../../utils/timeConvert';
import { nanoid } from 'nanoid';

interface Props {
  aging: AgingConfig;
  daysPerYear: number;
  onChange: (aging: AgingConfig) => void;
  onNext: () => void;
  onBack: () => void;
  title?: string;
  showImportHuman?: boolean;
  onImportHuman?: () => void;
}

export default function AgingTable({
  aging,
  daysPerYear,
  onChange,
  onNext,
  onBack,
  title,
  showImportHuman,
  onImportHuman,
}: Props) {
  const isValid = aging.lifeStages.every((ls) => ls.name.trim() !== '' && ls.simDays >= 0);

  const updateStage = (id: string, field: keyof LifeStage, value: string | number) => {
    const updated = aging.lifeStages.map((ls) => {
      if (ls.id !== id) return ls;
      const newLs = { ...ls, [field]: value };
      if (field === 'simDays') {
        newLs.yearsEquivalent = simDaysToYears(Number(value), daysPerYear);
      }
      return newLs;
    });
    onChange({ ...aging, lifeStages: updated });
  };

  const addStage = () => {
    const newStage: LifeStage = { id: nanoid(), name: '', simDays: 0, yearsEquivalent: 0 };
    onChange({ ...aging, lifeStages: [...aging.lifeStages, newStage] });
  };

  const removeStage = (id: string) => {
    onChange({ ...aging, lifeStages: aging.lifeStages.filter((ls) => ls.id !== id) });
  };

  const moveStage = (id: string, dir: -1 | 1) => {
    const stages = [...aging.lifeStages];
    const idx = stages.findIndex((ls) => ls.id === id);
    if (idx + dir < 0 || idx + dir >= stages.length) return;
    [stages[idx], stages[idx + dir]] = [stages[idx + dir], stages[idx]];
    onChange({ ...aging, lifeStages: stages });
  };

  return (
    <div className="wizard-step">
      <h2>{title ?? `${aging.label} Aging`}</h2>
      <p className="step-description">
        Enter the number of sim days for each life stage. Years will calculate automatically.
      </p>

      {showImportHuman && (
        <button className="btn-secondary btn-sm" onClick={onImportHuman} style={{ marginBottom: '1rem' }}>
          Import Human Aging Settings
        </button>
      )}

      <div className="aging-table-wrapper">
        <table className="aging-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Life Stage</th>
              <th>Sim Days</th>
              <th>≈ Years</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {aging.lifeStages.map((ls, idx) => (
              <tr key={ls.id}>
                <td className="order-col">
                  <button
                    className="btn-icon"
                    disabled={idx === 0}
                    onClick={() => moveStage(ls.id, -1)}
                    title="Move up"
                  >↑</button>
                  <button
                    className="btn-icon"
                    disabled={idx === aging.lifeStages.length - 1}
                    onClick={() => moveStage(ls.id, 1)}
                    title="Move down"
                  >↓</button>
                </td>
                <td>
                  <input
                    type="text"
                    value={ls.name}
                    placeholder="Stage name"
                    onChange={(e) => updateStage(ls.id, 'name', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={ls.simDays}
                    onChange={(e) => updateStage(ls.id, 'simDays', Number(e.target.value))}
                  />
                </td>
                <td className="years-col">
                  {ls.yearsEquivalent > 0 ? `${ls.yearsEquivalent} yr${ls.yearsEquivalent !== 1 ? 's' : ''}` : '—'}
                </td>
                <td>
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => removeStage(ls.id)}
                    title="Remove stage"
                  >×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button className="btn-secondary btn-sm" onClick={addStage} style={{ marginTop: '0.75rem' }}>
        + Add Life Stage
      </button>

      <div className="wizard-nav">
        <button className="btn-ghost" onClick={onBack}>← Back</button>
        <button className="btn-primary" disabled={!isValid} onClick={onNext}>
          Next →
        </button>
      </div>
    </div>
  );
}
