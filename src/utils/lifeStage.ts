import type { AgingConfig, SimEntry, TrackerConfig } from '../types/tracker';
import { formatChallengeDate } from './timeConvert';
import { computeAgeDays } from './simDates';

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
 * Compute life stage from total sim days lived.
 * Supports precise birth/death year + day-of-year, with legacy fallbacks.
 */
export function computeLifeStage(
  sim: SimEntry,
  config: TrackerConfig,
  currentDay: number,
  aging: AgingConfig = config.humanAging
): string {
  const ageDays = computeAgeDays(sim, config, currentDay);
  if (ageDays == null) return '';

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
