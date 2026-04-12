import type { SimEntry, TrackerConfig } from '../types/tracker';

export function yearFromDayNumber(dayNumber: number, config: Pick<TrackerConfig, 'startYear' | 'daysPerYear'>): number {
  const yearsElapsed = Math.floor((dayNumber - 1) / config.daysPerYear);
  return config.startYear + yearsElapsed;
}

export function parseDayNumberFromLegacyDate(dateStr?: string): number | undefined {
  if (!dateStr) return undefined;
  const m = dateStr.match(/Day\s*(\d+)/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

export function getBirthYear(sim: SimEntry, config: Pick<TrackerConfig, 'startYear' | 'daysPerYear'>): number | undefined {
  if (sim.birthYear) return sim.birthYear;
  const day = sim.birthDayNumber ?? parseDayNumberFromLegacyDate(sim.dateOfBirth);
  return day ? yearFromDayNumber(day, config) : undefined;
}

export function getDeathYear(sim: SimEntry, config: Pick<TrackerConfig, 'startYear' | 'daysPerYear'>): number | undefined {
  if (sim.deathYear) return sim.deathYear;
  const day = sim.deathDayNumber ?? parseDayNumberFromLegacyDate(sim.dateOfDeath);
  return day ? yearFromDayNumber(day, config) : undefined;
}

export function formatYear(year?: number): string {
  return year ? `Year ${year}` : '—';
}
