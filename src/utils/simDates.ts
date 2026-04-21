import type { SimEntry, TrackerConfig } from '../types/tracker';

export function yearFromDayNumber(dayNumber: number, config: Pick<TrackerConfig, 'startYear' | 'daysPerYear'>): number {
  const yearsElapsed = Math.floor((dayNumber - 1) / config.daysPerYear);
  return config.startYear + yearsElapsed;
}

export function dayOfYearFromDayNumber(dayNumber: number, config: Pick<TrackerConfig, 'daysPerYear'>): number {
  return ((dayNumber - 1) % config.daysPerYear) + 1;
}

export function absoluteDayFromYearAndDayOfYear(
  year: number,
  dayOfYear: number,
  config: Pick<TrackerConfig, 'startYear' | 'daysPerYear'>,
): number {
  return (year - config.startYear) * config.daysPerYear + dayOfYear;
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

export function getBirthDayOfYear(sim: SimEntry, config: Pick<TrackerConfig, 'daysPerYear'>): number | undefined {
  if (sim.birthDayOfYear) return sim.birthDayOfYear;
  const day = sim.birthDayNumber ?? parseDayNumberFromLegacyDate(sim.dateOfBirth);
  return day ? dayOfYearFromDayNumber(day, config) : undefined;
}

export function getDeathYear(sim: SimEntry, config: Pick<TrackerConfig, 'startYear' | 'daysPerYear'>): number | undefined {
  if (sim.deathYear && sim.deathYear >= (config.startYear ?? 0)) return sim.deathYear;
  const day = sim.deathDayNumber ?? parseDayNumberFromLegacyDate(sim.dateOfDeath);
  return day ? yearFromDayNumber(day, config) : undefined;
}

export function getDeathDayOfYear(sim: SimEntry, config: Pick<TrackerConfig, 'daysPerYear'>): number | undefined {
  if (sim.deathDayOfYear) return sim.deathDayOfYear;
  const day = sim.deathDayNumber ?? parseDayNumberFromLegacyDate(sim.dateOfDeath);
  return day ? dayOfYearFromDayNumber(day, config) : undefined;
}

export function getBirthAbsoluteDay(sim: SimEntry, config: Pick<TrackerConfig, 'startYear' | 'daysPerYear'>): number | undefined {
  const year = getBirthYear(sim, config);
  const dayOfYear = getBirthDayOfYear(sim, config);
  if (year == null) return undefined;
  return absoluteDayFromYearAndDayOfYear(year, dayOfYear ?? 1, config);
}

export function getDeathAbsoluteDay(sim: SimEntry, config: Pick<TrackerConfig, 'startYear' | 'daysPerYear'>): number | undefined {
  const year = getDeathYear(sim, config);
  if (year == null) return undefined;
  const dayOfYear = getDeathDayOfYear(sim, config);
  return absoluteDayFromYearAndDayOfYear(year, dayOfYear ?? config.daysPerYear, config);
}

export function formatYear(year?: number): string {
  return year != null ? `${year}` : '—';
}

export function currentYearFromCurrentDay(
  config: Pick<TrackerConfig, 'startYear' | 'daysPerYear'>,
  currentDay: number
): number {
  const yearsElapsed = Math.floor((Math.max(1, currentDay) - 1) / config.daysPerYear);
  return config.startYear + yearsElapsed;
}

export function computeAgeYears(
  sim: SimEntry,
  config: Pick<TrackerConfig, 'startYear' | 'daysPerYear'>,
  currentDay: number
): number | undefined {
  const birthAbs = getBirthAbsoluteDay(sim, config);
  if (birthAbs == null) return undefined;

  const deathAbs = getDeathAbsoluteDay(sim, config);
  const endAbs = deathAbs ?? Math.max(1, currentDay);
  const daysAlive = Math.max(0, endAbs - birthAbs);
  return Math.floor(daysAlive / config.daysPerYear);
}

export function computeAgeDays(
  sim: SimEntry,
  config: Pick<TrackerConfig, 'startYear' | 'daysPerYear'>,
  currentDay: number
): number | undefined {
  const birthAbs = getBirthAbsoluteDay(sim, config);
  if (birthAbs == null) return undefined;

  const deathAbs = getDeathAbsoluteDay(sim, config);
  const endAbs = deathAbs ?? Math.max(1, currentDay);
  return Math.max(0, endAbs - birthAbs);
}
