import type { AgingConfig, SimEntry, TrackerConfig } from '../types/tracker';
import { formatChallengeDate } from './timeConvert';

export function getFullName(sim: Pick<SimEntry, 'firstName' | 'lastName' | 'name'>): string {
  const combined = `${(sim.firstName ?? '').trim()} ${(sim.lastName ?? '').trim()}`.trim();
  return combined || (sim.name ?? '').trim() || '(unnamed)';
}

export function parseDayNumberFromLegacyDate(dateOfBirth?: string): number | undefined {
  if (!dateOfBirth) return undefined;
  const m = dateOfBirth.match(/Day\s*(\d+)/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

export function computeLifeStage(
  sim: SimEntry,
  config: TrackerConfig,
  currentDay: number,
  aging: AgingConfig = config.humanAging
): string {
  const birthDay = sim.birthDayNumber ?? parseDayNumberFromLegacyDate(sim.dateOfBirth);
  if (!birthDay) return '';

  const ageDays = Math.max(0, currentDay - birthDay);
  let cursor = 0;

  for (const stage of aging.lifeStages) {
    const len = Math.max(0, stage.simDays ?? 0);
    if (ageDays < cursor + len) return stage.name;
    cursor += len;
  }

  // Past the last stage length — treat as last stage
  return aging.lifeStages.length ? aging.lifeStages[aging.lifeStages.length - 1].name : '';
}

export function formatDayNumber(dayNumber: number | undefined, config: Pick<TrackerConfig, 'startYear'|'daysPerYear'|'startDayOfWeek'>): string {
  if (!dayNumber) return '—';
  return formatChallengeDate(dayNumber, config);
}
