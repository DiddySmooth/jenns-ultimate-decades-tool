import { useWizard } from '../../hooks/useWizard';
import Step1BasicConfig from './Step1BasicConfig';
import AgingTable from './AgingTable';
import Step3PetsOccults from './Step3PetsOccults';
import Step4Review from './Step4Review';
import type { TrackerSave, AgingConfig } from '../../types/tracker';
import { generateTimeline } from '../../utils/timeConvert';
import { nanoid } from 'nanoid';

interface Props {
  onComplete: (save: TrackerSave) => void;
}

export default function SetupWizard({ onComplete }: Props) {
  const {
    state,
    setStep,
    updateBasicConfig,
    updateHumanAging,
    setSelectedPets,
    setSelectedOccults,
    updateAgingConfig,
    recalcYears,
  } = useWizard();

  // Build the list of pet/occult aging steps we need to walk through
  const allExtraAging: AgingConfig[] = [
    ...state.petAging,
    ...state.occultAging,
  ];
  const extraStepCount = allExtraAging.length;

  // Step numbering:
  // 1 = BasicConfig
  // 2 = HumanAging
  // 3 = PetsOccults selection
  // 4..4+N-1 = individual pet/occult aging tables
  // 4+N = Review

  const reviewStep = 4 + extraStepCount;

  const handleComplete = () => {
    const { basicConfig, humanAging, petAging, occultAging } = state;
    const startYear = Number(basicConfig.startYear);
    const endYear = 2050;
    const totalDays = (endYear - startYear + 1) * basicConfig.daysPerYear;
    const timeline = generateTimeline(
      { startYear, daysPerYear: basicConfig.daysPerYear, startDayOfWeek: basicConfig.startDayOfWeek },
      totalDays
    );

    const save: TrackerSave = {
      config: {
        id: nanoid(),
        name: `Decades Challenge — started ${startYear}`,
        startYear,
        daysPerYear: basicConfig.daysPerYear,
        startDayOfWeek: basicConfig.startDayOfWeek,
        humanAging,
        pets: petAging,
        occults: occultAging,
        customColumns: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      sims: [],
      timeline,
      currentDay: 1,
      pregnancyCouples: [],
      unions: [],
      familyTree: { nodes: [], edges: [] },
      familyTreeConfig: {
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
          hideDeadBranches: false,
        },
      },
    };

    onComplete(save);
  };

  // Determine which extra aging step we're on (if any)
  const extraStepIndex = state.step - 4; // 0-based index into allExtraAging

  return (
    <div className="wizard-container">
      <div className="wizard-progress">
        <span>Step {state.step} of {reviewStep}</span>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(state.step / reviewStep) * 100}%` }} />
        </div>
      </div>

      {state.step === 1 && (
        <Step1BasicConfig
          config={state.basicConfig}
          onChange={updateBasicConfig}
          onNext={() => setStep(2)}
        />
      )}

      {state.step === 2 && (
        <AgingTable
          aging={state.humanAging}
          daysPerYear={Number(state.basicConfig.daysPerYear)}
          onChange={updateHumanAging}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
          title="Human Aging"
        />
      )}

      {state.step === 3 && (
        <Step3PetsOccults
          selectedPets={state.selectedPets}
          selectedOccults={state.selectedOccults}
          onPetsChange={setSelectedPets}
          onOccultChange={setSelectedOccults}
          onNext={() => setStep(extraStepCount > 0 ? 4 : reviewStep)}
          onBack={() => setStep(2)}
        />
      )}

      {state.step >= 4 && state.step < reviewStep && allExtraAging[extraStepIndex] && (
        <AgingTable
          aging={allExtraAging[extraStepIndex]}
          daysPerYear={Number(state.basicConfig.daysPerYear)}
          onChange={(updated) => updateAgingConfig(updated.type, updated)}
          onNext={() => setStep(state.step + 1)}
          onBack={() => setStep(state.step - 1)}
          title={`${allExtraAging[extraStepIndex].label} Aging`}
          showImportHuman
          onImportHuman={() => {
            const imported = recalcYears(
              { ...state.humanAging, type: allExtraAging[extraStepIndex].type, label: allExtraAging[extraStepIndex].label },
              Number(state.basicConfig.daysPerYear)
            );
            updateAgingConfig(imported.type, imported);
          }}
        />
      )}

      {state.step === reviewStep && (
        <Step4Review
          state={state}
          onComplete={handleComplete}
          onBack={() => setStep(reviewStep - 1)}
        />
      )}
    </div>
  );
}
