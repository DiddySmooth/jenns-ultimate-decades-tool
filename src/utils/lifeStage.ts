import type { AgingConfig, SimEntry, TrackerConfig } from '../types/tracker';
import { formatChallengeDate } from './timeConvert';
import { currentYearFromCurrentDay, getBirthYear, getDeathYear } from './simDates';

export function getFullName(sim: Pick<SimEntry, 'firstName' | 'lastName' | 'name' | 'maidenName' | 'showMaidenName'>): string {
  const first = (sim.firstName ?? '').trim();
  const last = (sim.lastName ?? '').trim();
  const maiden = (sim.maidenName ?? '').trim();
  if (first || last) {
    if (maiden && sim.showMaidenName) {
      return `${first}${maiden ? ` (${maiden})` : ''} ${last}`.trim();
    }
    return `${first} ${last}`.trim();
  }
  return (sim.name ?? '').trim() || '(unnamed)';
}

/**
 * Compute life stage from birth YEAR (preferred) + current timeline year.
 * If birthYear is missing, falls back to legacy day-number-based fields.
 */
export function computeLifeStage(
  sim: SimEntry,
  config: TrackerConfig,
  currentDay: number,
  aging: AgingConfig = config.humanAging
): string {
  const birthYear = getBirthYear(sim, config);
  if (!birthYear) return '';

  // Convert current day -> year
  const currentYear = currentYearFromCurrentDay(config, currentDay);

  // If dead, compute stage based on age at death (not current year)
  const deathYear = getDeathYear(sim, config);
  const endYear = deathYear ?? currentYear;

  const ageYears = Math.max(0, endYear - birthYear);
  const ageDays = ageYears * config.daysPerYear;

  let cursor = 0;
  for (const stage of aging.lifeStages) {
    const len = Math.max(0, stage.simDays ?? 0);
    if (ageDays < cursor + len) return stage.name;
    cursor += len;
  }
  return aging.lifeStages.length ? aging.lifeStages[aging.lifeStages.length - 1].name : '';
}

export function formatDayNumber(dayNumber: number | undefined, config: Pick<TrackerConfig, 'startYear'|'daysPerYear'|'startDayOfWeek'>): string {
  if (!dayNumber) return '—';
  return formatChallengeDate(dayNumber, config);
}
