import type { AgingConfig, SimEntry, TrackerConfig } from '../types/tracker';
import { formatChallengeDate } from './timeConvert';
import { getBirthYear } from './simDates';

export function getFullName(sim: Pick<SimEntry, 'firstName' | 'lastName' | 'name'>): string {
  const combined = `${(sim.firstName ?? '').trim()} ${(sim.lastName ?? '').trim()}`.trim();
  return combined || (sim.name ?? '').trim() || '(unnamed)';
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
  const yearsElapsed = Math.floor((currentDay - 1) / config.daysPerYear);
  const currentYear = config.startYear + yearsElapsed;

  const ageYears = Math.max(0, currentYear - birthYear);
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
