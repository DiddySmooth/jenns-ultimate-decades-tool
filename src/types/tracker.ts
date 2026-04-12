export interface LifeStage {
  id: string;
  name: string;
  simDays: number;
  yearsEquivalent: number; // auto-calculated: simDays / daysPerYear
}

export type SimType =
  | 'human'
  | 'dog'
  | 'cat'
  | 'horse'
  | 'vampire'
  | 'werewolf'
  | 'fairy'
  | 'mermaid'
  | 'ghost'
  | 'alien'
  | 'spellcaster'
  | string;

export interface AgingConfig {
  type: SimType;
  label: string;
  lifeStages: LifeStage[];
}

export interface TrackerConfig {
  id: string;
  name: string;
  startYear: number;
  daysPerYear: number;       // default: 4
  startDayOfWeek: string;    // default: 'Sunday'
  humanAging: AgingConfig;
  pets: AgingConfig[];
  occults: AgingConfig[];
  customColumns: { id: string; label: string }[]; // user-added columns (occult stages etc)
  createdAt: string;
  updatedAt: string;
}

export type SimSex = 'Female' | 'Male' | 'Intersex' | 'Non-binary' | 'Unknown';

export interface SimEntry {
  id: string;

  // Name
  firstName: string;
  lastName: string;

  // Back-compat (older saves)
  name?: string;

  sex?: SimSex;

  // Relationships (store ids)
  fatherId?: string;
  motherId?: string;
  spouseId?: string;

  // Dates (by timeline day number, recommended)
  birthDayNumber?: number;
  deathDayNumber?: number;
  marriageDayNumber?: number;

  // Legacy string fields (still supported/displayed)
  dateOfBirth?: string;
  dateOfDeath?: string;

  placeOfBirth?: string;
  causeOfDeath?: string;

  // Derived in UI (auto-computed from birthDayNumber + currentDay)
  // currentLifeStage is kept for legacy only
  currentLifeStage?: string;

  generation: number;
  notes?: string;

  // Future/optional trackers
  married?: boolean;
  pregnancyAttempts?: number;
  pregnancyAttemptsUsed?: number;
}

export type TimelineEventType = 'birthday' | 'death' | 'event' | 'wedding' | 'custom';

export interface TimelineEvent {
  id: string;
  dayNumber: number;
  type: TimelineEventType;
  simId?: string;
  simName?: string;
  description: string;
}

export interface TimelineDay {
  dayNumber: number;
  dayOfWeek: string;
  year: number;
  marked: boolean;
  events: TimelineEvent[];    // general events column
  deaths: string;             // deaths column (free text)
  births: string;             // births column (free text)
  lifeStageCells: Record<string, string>; // keyed by life stage id — any life stage column
}

export interface TrackerSave {
  config: TrackerConfig;
  sims: SimEntry[];
  timeline: TimelineDay[];
  currentDay: number;
}

// Setup wizard state
export interface WizardState {
  step: number;
  basicConfig: {
    startYear: number | '';
    daysPerYear: number;
    startDayOfWeek: string;
  };
  humanAging: AgingConfig;
  selectedPets: SimType[];
  selectedOccults: SimType[];
  petAging: AgingConfig[];
  occultAging: AgingConfig[];
}

export const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const DEFAULT_HUMAN_LIFE_STAGES: Omit<LifeStage, 'yearsEquivalent'>[] = [
  { id: 'baby', name: 'Baby / Newborn', simDays: 0 },
  { id: 'infant', name: 'Infant', simDays: 0 },
  { id: 'toddler', name: 'Toddler', simDays: 0 },
  { id: 'child', name: 'Child', simDays: 0 },
  { id: 'teen', name: 'Teen', simDays: 0 },
  { id: 'youngadult', name: 'Young Adult', simDays: 0 },
  { id: 'adult', name: 'Adult', simDays: 0 },
  { id: 'elder', name: 'Elder', simDays: 0 },
];

// Default pet life stages (Puppy/Kitten, Adult, Elder — 3 stages)
export const DEFAULT_PET_LIFE_STAGES: Omit<LifeStage, 'yearsEquivalent'>[] = [
  { id: 'pet_puppy', name: 'Puppy / Kitten', simDays: 0 },
  { id: 'pet_adult', name: 'Adult', simDays: 0 },
  { id: 'pet_elder', name: 'Elder', simDays: 0 },
];

export const DEFAULT_HORSE_LIFE_STAGES: Omit<LifeStage, 'yearsEquivalent'>[] = [
  { id: 'horse_foal', name: 'Foal', simDays: 0 },
  { id: 'horse_adult', name: 'Adult', simDays: 0 },
  { id: 'horse_elder', name: 'Elder', simDays: 0 },
];

export const PET_TYPES: { type: SimType; label: string }[] = [
  { type: 'dog', label: 'Dogs' },
  { type: 'cat', label: 'Cats' },
  { type: 'horse', label: 'Horses' },
  { type: 'custom_pet', label: 'Custom' },
];

export const OCCULT_TYPES: { type: SimType; label: string }[] = [
  { type: 'vampire', label: 'Vampire' },
  { type: 'werewolf', label: 'Werewolf' },
  { type: 'fairy', label: 'Fairy' },
  { type: 'mermaid', label: 'Mermaid' },
  { type: 'ghost', label: 'Ghost' },
  { type: 'alien', label: 'Alien' },
  { type: 'spellcaster', label: 'Spellcaster' },
  { type: 'custom_occult', label: 'Custom' },
];
