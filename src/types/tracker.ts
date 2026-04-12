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
  createdAt: string;
  updatedAt: string;
}

export interface SimEntry {
  id: string;
  name: string;
  dateOfBirth: string;       // e.g. "Day 1, Year 1890"
  dateOfDeath?: string;
  currentLifeStage: string;
  causeOfDeath?: string;
  generation: number;
  notes?: string;
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
  events: TimelineEvent[];
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
