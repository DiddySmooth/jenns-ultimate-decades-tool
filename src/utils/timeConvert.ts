import type { TimelineDay, TrackerConfig } from '../types/tracker';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Calculate equivalent years from sim days given daysPerYear config.
 */
export function simDaysToYears(simDays: number, daysPerYear: number): number {
  if (daysPerYear === 0) return 0;
  return Math.round((simDays / daysPerYear) * 10) / 10;
}

/**
 * Given a day number and config, return the real-world year and day-of-week.
 */
export function dayNumberToDate(
  dayNumber: number,
  config: Pick<TrackerConfig, 'startYear' | 'daysPerYear' | 'startDayOfWeek'>
): { year: number; dayOfWeek: string } {
  const { startYear, daysPerYear, startDayOfWeek } = config;
  const startDayIndex = DAYS_OF_WEEK.indexOf(startDayOfWeek);
  const yearsElapsed = Math.floor((dayNumber - 1) / daysPerYear);
  const year = startYear + yearsElapsed;
  const dayOfWeekIndex = (startDayIndex + (dayNumber - 1)) % 7;
  const dayOfWeek = DAYS_OF_WEEK[dayOfWeekIndex];
  return { year, dayOfWeek };
}

/**
 * Generate a flat timeline array for N total sim days.
 */
export function generateTimeline(
  config: Pick<TrackerConfig, 'startYear' | 'daysPerYear' | 'startDayOfWeek'>,
  totalDays: number
): TimelineDay[] {
  const days: TimelineDay[] = [];
  for (let i = 1; i <= totalDays; i++) {
    const { year, dayOfWeek } = dayNumberToDate(i, config);
    days.push({
      dayNumber: i,
      dayOfWeek,
      year,
      marked: false,
      events: [],
      deaths: '',
      births: '',
      lifeStageCells: {},
    });
  }
  return days;
}

/**
 * Format a challenge date string from a day number.
 */
export function formatChallengeDate(
  dayNumber: number,
  config: Pick<TrackerConfig, 'startYear' | 'daysPerYear' | 'startDayOfWeek'>
): string {
  const { year, dayOfWeek } = dayNumberToDate(dayNumber, config);
  return `${dayOfWeek}, Year ${year} (Day ${dayNumber})`;
}
