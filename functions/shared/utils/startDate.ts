import growingSeason from '../settings/growingSeason.json';

/** Oldest selectable year for user requests (ML runs do not use this). */
export const MIN_START_YEAR = 2020;

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Growing season start of the given year, e.g. "2022-04-01". */
export const seasonStartOf = (year: number): string =>
  `${year}-${pad2(growingSeason.startMonth)}-${pad2(growingSeason.startDay)}`;

/**
 * A user-supplied start_date must be the growing season start of a year
 * between MIN_START_YEAR and the current year, and not in the future.
 * Accepts both "2022-04-01" and "2022-04-01T00:00:00Z".
 */
export const isValidStartDate = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const year = Number(value.slice(0, 4));
  const currentYear = new Date().getUTCFullYear();
  if (!Number.isInteger(year) || year < MIN_START_YEAR || year > currentYear) return false;
  if (value.slice(0, 10) !== seasonStartOf(year)) return false;
  return new Date(seasonStartOf(year)).getTime() <= Date.now();
};