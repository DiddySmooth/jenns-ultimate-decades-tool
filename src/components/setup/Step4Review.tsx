import type { WizardState } from '../../types/tracker';

interface Props {
  state: WizardState;
  onComplete: () => void;
  onBack: () => void;
}

export default function Step4Review({ state, onComplete, onBack }: Props) {
  const { basicConfig, humanAging, selectedPets, selectedOccults } = state;

  return (
    <div className="wizard-step">
      <h2>Review &amp; Complete</h2>
      <p className="step-description">
        Look over your settings before generating your tracker.
      </p>

      <div className="review-section">
        <h3>Time Settings</h3>
        <ul className="review-list">
          <li><span>Start Year:</span> {basicConfig.startYear}</li>
          <li><span>Sim Days / Year:</span> {basicConfig.daysPerYear}</li>
          <li><span>Start Day:</span> {basicConfig.startDayOfWeek}</li>
        </ul>
      </div>

      <div className="review-section">
        <h3>Human Aging ({humanAging.lifeStages.length} stages)</h3>
        <ul className="review-list">
          {humanAging.lifeStages.map((ls) => (
            <li key={ls.id}>
              <span>{ls.name}:</span> {ls.simDays} days ({ls.yearsEquivalent} yrs)
            </li>
          ))}
        </ul>
      </div>

      {selectedPets.length > 0 && (
        <div className="review-section">
          <h3>Pets</h3>
          <p>{selectedPets.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}</p>
        </div>
      )}

      {selectedOccults.length > 0 && (
        <div className="review-section">
          <h3>Occults</h3>
          <p>{selectedOccults.map((o) => o.charAt(0).toUpperCase() + o.slice(1)).join(', ')}</p>
        </div>
      )}

      <div className="wizard-nav">
        <button className="btn-ghost" onClick={onBack}>← Back</button>
        <button className="btn-primary" onClick={onComplete}>
          Generate My Tracker ✓
        </button>
      </div>
    </div>
  );
}
