// Existence questions over a date range (FR-11).
//
// Nothing here enumerates dates. A partial reading survives while *some*
// in-range completion exists, and every question below is answered by
// arithmetic over years: a two-digit year offers at most a handful of
// centuries, a one- or three-digit year at most ten completions.

import { daysInMonth, isoOf, MAX_YEAR, MIN_YEAR } from './dates.js';

function yearBounds(range) {
  const from = range && range.from ? Number(range.from.slice(0, 4)) : MIN_YEAR;
  const to = range && range.to ? Number(range.to.slice(0, 4)) : MAX_YEAR;
  return { from, to };
}

export function isIsoInRange(iso, range) {
  if (!iso) return false;
  if (range && range.from && iso < range.from) return false;
  if (range && range.to && iso > range.to) return false;
  return true;
}

/** Years a complete two-digit year can mean, closest century first avoided:
 * the classifier sorts. Century search is bounded by the range. */
export function centuryYears(twoDigits, range) {
  const shortYear = Number(twoDigits);
  const { from, to } = yearBounds(range);
  const years = [];
  const firstCentury = Math.floor(from / 100) - 1;
  const lastCentury = Math.floor(to / 100) + 1;
  for (let century = firstCentury; century <= lastCentury; century += 1) {
    const year = shortYear + 100 * century;
    if (year >= from && year <= to && year >= MIN_YEAR && year <= MAX_YEAR) years.push(year);
  }
  return years;
}

/**
 * Every in-range year whose decimal form *ends* with `digits` — what a short
 * year run can be read as (FR-13, C17). `5` gives …, 1995, 2005, 2025 … so the
 * preferred one is the closest to today, and `952` reaches 1952 rather than
 * 2952.
 */
export function suffixYears(digits, range) {
  if (!digits || digits.length > 3) return [];
  // One digit is the second digit of a two-digit year, so `5` means 05 and the
  // step is a century, not a decade: 1905, 2005, 2105 (C17).
  const modulus = 10 ** Math.max(2, digits.length);
  const value = Number(digits);
  if (!Number.isFinite(value) || value >= modulus) return [];

  const { from, to } = yearBounds(range);
  const aligned = (from % modulus + modulus) % modulus;
  const offset = (value - aligned + modulus) % modulus;
  const years = [];

  for (let year = from + offset; year <= to; year += modulus) {
    if (year >= MIN_YEAR && year <= MAX_YEAR) years.push(year);
  }
  return years;
}

/** Every four-digit year of the range whose decimal form starts with
 * `digits` — used for an unfinished year (1 or 3 digits, FR-10). */
export function completionYears(digits, range) {
  const { from, to } = yearBounds(range);
  const years = [];

  if (digits.length === 1) {
    const tens = Number(digits) * 10;
    const firstCentury = Math.floor(from / 100) - 1;
    const lastCentury = Math.floor(to / 100) + 1;
    for (let century = firstCentury; century <= lastCentury; century += 1) {
      for (let unit = 0; unit <= 9; unit += 1) {
        const year = tens + unit + 100 * century;
        if (year >= from && year <= to && year >= MIN_YEAR && year <= MAX_YEAR) years.push(year);
      }
    }
  } else if (digits.length === 3) {
    const base = Number(digits) * 10;
    for (let unit = 0; unit <= 9; unit += 1) {
      const year = base + unit;
      if (year >= from && year <= to && year >= MIN_YEAR && year <= MAX_YEAR) years.push(year);
    }
  }

  return [...new Set(years)].sort((left, right) => left - right);
}

/**
 * Does any in-range date have this day and month, with the year still open?
 * An open-ended range always does (every month/day exists in some year);
 * a closed range is walked year by year, which is bounded by its own span.
 */
export function dateExistsWithoutYear(day, month, range) {
  if (!range || !range.from || !range.to) return true;
  const fromYear = Number(range.from.slice(0, 4));
  const toYear = Number(range.to.slice(0, 4));
  for (let year = fromYear; year <= toYear; year += 1) {
    if (day > daysInMonth(year, month)) continue;
    const iso = isoOf(year, month, day);
    if (iso >= range.from && iso <= range.to) return true;
  }
  return false;
}
