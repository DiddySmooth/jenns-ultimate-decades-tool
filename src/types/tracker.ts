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

export interface AvatarCrop {
  /** 0..100; background-position X percentage */
  x: number;
  /** 0..100; background-position Y percentage */
  y: number;
  /** 1..3 typical; background-size multiplier */
  zoom: number;
}

export interface SimEntry {
  id: string;
  traits?: string[];

  // Name
  firstName: string;
  lastName: string;
  maidenName?: string;         // optional maiden/birth name
  showMaidenName?: boolean;    // if true, display as "First (Maiden) Last" on family tree

  // Back-compat (older saves)
  name?: string;

  sex?: SimSex;

  // Relationships (store ids)
  fatherId?: string;
  motherId?: string;
  spouseId?: string;

  // If parents had multiple unions, allow explicit assignment
  birthUnionId?: string;

  // Dates
  birthYear?: number;
  birthDayOfYear?: number;   // 1..daysPerYear; preferred for accurate aging/life stage
  deathYear?: number;
  deathDayOfYear?: number;   // 1..daysPerYear; preferred for accurate aging/life stage
  marriageYear?: number;

  // Legacy fields (still supported)
  birthDayNumber?: number;
  deathDayNumber?: number;
  marriageDayNumber?: number;
  dateOfBirth?: string;
  dateOfDeath?: string;

  placeOfBirth?: string;
  causeOfDeath?: string;

  // Avatar
  avatarUrl?: string;          // public URL if used
  avatarBlobKey?: string;      // blob path if used
  avatarCrop?: AvatarCrop;     // client-side crop metadata (no re-upload)


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
  lifeStageCells: Record<string, string>; // keyed by life stage id — any life stage column
}

export type PregnancyStatus = 'trying' | 'pregnant' | 'done' | 'infertile';

export interface PregnancyCouple {
  id: string;
  fatherId?: string;
  motherId?: string;
  married: boolean;
  babyGen: number;
  totalTries: number;
  status: PregnancyStatus;
  tries: boolean[]; // length should match totalTries
  notes?: string;
}

export type UnionEndReason = 'divorce' | 'death' | 'unknown';

export interface UnionNode {
  id: string;
  partnerAId?: string;
  partnerBId?: string;
  startYear?: number;
  endYear?: number;
  endReason?: UnionEndReason;
  notes?: string;
}

export interface FamilyTreeState {
  nodes: Array<{ id: string; type: 'sim' | 'union'; position: { x: number; y: number } }>;
  edges: Array<{ id: string; source: string; target: string; type?: string }>; 
}

export type AvatarShape = 'circle' | 'rounded' | 'square';

export type RingColorMode = 'generation' | 'gender' | 'lastName';

export interface FamilyTreeDisplayConfig {
  showBirthYear: boolean;
  showDeathYear: boolean;
  showAge: boolean;
  showLifeStage: boolean;
  showGeneration: boolean;
  ringColorMode?: RingColorMode;

  /** Compact mode: only render avatar + name on the node; other fields show on hover. */
  compactNodes?: boolean;
}

export interface FamilyTreeFilterConfig {
  hiddenLifeStages: string[]; // hide sims in these stages
  hideDeadSims: boolean;      // hide sims that have died
  hideDeadBranches: boolean;  // hide sims where they + all descendants are dead
}

export interface FamilyTreeConfig {
  avatarShape: AvatarShape;
  display: FamilyTreeDisplayConfig;
  filters: FamilyTreeFilterConfig;
}

export interface TrackerSave {
  config: TrackerConfig;
  sims: SimEntry[];
  timeline: TimelineDay[];
  currentDay: number;
  pregnancyCouples: PregnancyCouple[];

  unions: UnionNode[];
  familyTree: FamilyTreeState;
  familyTreeConfig: FamilyTreeConfig;
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
