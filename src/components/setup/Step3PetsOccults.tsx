import { PET_TYPES, OCCULT_TYPES } from '../../types/tracker';
import type { SimType } from '../../types/tracker';

interface Props {
  selectedPets: SimType[];
  selectedOccults: SimType[];
  onPetsChange: (pets: SimType[]) => void;
  onOccultChange: (occults: SimType[]) => void;
  onNext: () => void;
  onBack: () => void;
}

function toggle(arr: SimType[], val: SimType): SimType[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

export default function Step3PetsOccults({
  selectedPets,
  selectedOccults,
  onPetsChange,
  onOccultChange,
  onNext,
  onBack,
}: Props) {
  return (
    <div className="wizard-step">
      <h2>Pets &amp; Occults</h2>
      <p className="step-description">
        Select any pet or occult types you want to track. Each will get its own aging configuration.
        Skip this step if you only play with human Sims.
      </p>

      <div className="checklist-section">
        <h3>Pets</h3>
        <ul className="checklist">
          {PET_TYPES.map(({ type, label }) => (
            <li key={type}>
              <label>
                <input
                  type="checkbox"
                  checked={selectedPets.includes(type)}
                  onChange={() => onPetsChange(toggle(selectedPets, type))}
                />
                {label}
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="checklist-section">
        <h3>Occults</h3>
        <ul className="checklist">
          {OCCULT_TYPES.map(({ type, label }) => (
            <li key={type}>
              <label>
                <input
                  type="checkbox"
                  checked={selectedOccults.includes(type)}
                  onChange={() => onOccultChange(toggle(selectedOccults, type))}
                />
                {label}
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="wizard-nav">
        <button className="btn-ghost" onClick={onBack}>← Back</button>
        <button className="btn-primary" onClick={onNext}>
          {selectedPets.length === 0 && selectedOccults.length === 0 ? 'Skip →' : 'Next →'}
        </button>
      </div>
    </div>
  );
}
