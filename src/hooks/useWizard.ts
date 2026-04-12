import { useState } from 'react';
import { DEFAULT_HUMAN_LIFE_STAGES, DEFAULT_PET_LIFE_STAGES, DEFAULT_HORSE_LIFE_STAGES } from '../types/tracker';
import type { WizardState, AgingConfig, SimType } from '../types/tracker';
import { simDaysToYears } from '../utils/timeConvert';

const defaultHumanAging: AgingConfig = {
  type: 'human',
  label: 'Human',
  lifeStages: DEFAULT_HUMAN_LIFE_STAGES.map((s) => ({ ...s, yearsEquivalent: 0 })),
};

const initialState: WizardState = {
  step: 1,
  basicConfig: {
    startYear: '',
    daysPerYear: 4,
    startDayOfWeek: 'Sunday',
  },
  humanAging: defaultHumanAging,
  selectedPets: [],
  selectedOccults: [],
  petAging: [],
  occultAging: [],
};

export function useWizard() {
  const [state, setState] = useState<WizardState>(initialState);

  const setStep = (step: number) => setState((s) => ({ ...s, step }));

  const updateBasicConfig = (patch: Partial<WizardState['basicConfig']>) =>
    setState((s) => ({ ...s, basicConfig: { ...s.basicConfig, ...patch } }));

  const updateHumanAging = (aging: AgingConfig) =>
    setState((s) => ({ ...s, humanAging: aging }));

  const setSelectedPets = (pets: SimType[]) => {
    setState((s) => {
      const petAging = pets.map((type) => {
        const existing = s.petAging.find((a) => a.type === type);
        if (existing) return existing;
        const defaultStages = type === 'horse' ? DEFAULT_HORSE_LIFE_STAGES : DEFAULT_PET_LIFE_STAGES;
        return {
          type,
          label: type === 'dog' ? 'Dogs' : type === 'cat' ? 'Cats' : type === 'horse' ? 'Horses' : 'Custom Pet',
          lifeStages: defaultStages.map((ls) => ({ ...ls, id: `${type}-${ls.id}`, yearsEquivalent: 0 })),
        };
      });
      return { ...s, selectedPets: pets, petAging };
    });
  };

  const setSelectedOccults = (occults: SimType[]) => {
    setState((s) => {
      const occultAging = occults.map((type) => {
        const existing = s.occultAging.find((a) => a.type === type);
        return existing ?? {
          type,
          label: type.charAt(0).toUpperCase() + type.slice(1),
          lifeStages: DEFAULT_HUMAN_LIFE_STAGES.map((ls) => ({ ...ls, id: `${type}-${ls.id}`, yearsEquivalent: 0 })),
        };
      });
      return { ...s, selectedOccults: occults, occultAging };
    });
  };

  const updateAgingConfig = (type: SimType, aging: AgingConfig) => {
    setState((s) => ({
      ...s,
      petAging: s.petAging.map((a) => (a.type === type ? aging : a)),
      occultAging: s.occultAging.map((a) => (a.type === type ? aging : a)),
    }));
  };

  const recalcYears = (aging: AgingConfig, daysPerYear: number): AgingConfig => ({
    ...aging,
    lifeStages: aging.lifeStages.map((ls) => ({
      ...ls,
      yearsEquivalent: simDaysToYears(ls.simDays, daysPerYear),
    })),
  });

  return {
    state,
    setStep,
    updateBasicConfig,
    updateHumanAging,
    setSelectedPets,
    setSelectedOccults,
    updateAgingConfig,
    recalcYears,
  };
}
