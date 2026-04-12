import type { WizardState } from '../../types/tracker';

interface Props {
  state: WizardState;
  onComplete: () => void;
  onBack: () => void;
}

export default function Step4Review({ state, onComplete, onBack }: Props) {
  const { basicConfig, humanAging, petAging, occultAging } = state;

  const endYear = 2050;
  const totalDays = (endYear - Number(basicConfig.startYear) + 1) * basicConfig.daysPerYear;

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
          <li><span>End Year:</span> 2050</li>
          <li><span>Total Days:</span> {totalDays}</li>
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

      {petAging.length > 0 && (
        <div className="review-section">
          <h3>Pets</h3>
          {petAging.map((config) => (
            <div key={config.type} className="review-subgroup">
              <h4>{config.label} ({config.lifeStages.length} stages)</h4>
              <ul className="review-list">
                {config.lifeStages.map((ls) => (
                  <li key={ls.id}>
                    <span>{ls.name}:</span> {ls.simDays} days ({ls.yearsEquivalent} yrs)
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {occultAging.length > 0 && (
        <div className="review-section">
          <h3>Occults</h3>
          {occultAging.map((config) => (
            <div key={config.type} className="review-subgroup">
              <h4>{config.label} ({config.lifeStages.length} stages)</h4>
              <ul className="review-list">
                {config.lifeStages.map((ls) => (
                  <li key={ls.id}>
                    <span>{ls.name}:</span> {ls.simDays} days ({ls.yearsEquivalent} yrs)
                  </li>
                ))}
              </ul>
            </div>
          ))}
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
