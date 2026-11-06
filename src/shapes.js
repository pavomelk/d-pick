// Segments → readings (FR-4 … FR-13).
//
// A separator pins the parts: `25/5/2024` is three parts, and a run that does
// not fit its part is not re-split (`255/24` has two parts and `255` is not a
// day). A free digit run has no such pins, so it is filled greedily left to
// right in the assumed order and a part that has taken its digits is never
// re-split later (C16): two digits whenever they are valid, one only when two
// would not be — `52` is day 5 + month 2, `1225` is day 12 + month 2 + year 5.
//
// Readings that differ only by century (a short year, FR-13) or by the month a
// letter run resolves to (FR-9) are the alternatives the list exposes.

import { isoOf, isValidDate } from './dates.js';
import {
  completionYears,
  dateExistsWithoutYear,
  isIsoInRange,
  suffixYears,
} from './exists.js';
import { MONTH_NAMES } from './format.js';

const PART_ORDER = {
  little: ['day', 'month', 'year'],
  middle: ['month', 'day', 'year'],
};

const PART_CAP = { day: 2, month: 2, year: 4 };

export function readingsFor(scanned, range) {
  if (!scanned.ok || scanned.empty) return [];

  const readings = [];
  for (const endianness of ['little', 'middle']) {
    readings.push(...readSegments(scanned.segments, endianness, range, scanned.free));
  }
  return readings;
}

function monthsMatching(text) {
  const prefix = text.toLowerCase();
  const months = [];
  MONTH_NAMES.forEach((name, index) => {
    if (name.toLowerCase().startsWith(prefix)) months.push(index + 1);
  });
  return months;
}

function validDay(value) {
  return value >= 1 && value <= 31;
}

function validMonth(value) {
  return value >= 1 && value <= 12;
}

function readSegments(segments, endianness, range, spill) {
  const order = PART_ORDER[endianness];
  const spans = { day: null, month: null, year: null };
  let day = null;
  let months = null;
  let yearDigits = null;
  let slot = 0;

  for (const segment of segments) {
    if (slot >= order.length) return [];
    const part = order[slot];

    if (segment.kind === 'letter') {
      // A letter run can only be the month (FR-3).
      if (part !== 'month') return [];
      const matched = monthsMatching(segment.text);
      if (matched.length === 0) return [];
      months = matched;
      spans.month = [segment.start, segment.end];
      slot += 1;
      continue;
    }

    // Pinned: one segment per part, however long the segment is.
    if (!spill) {
      if (segment.text.length > PART_CAP[part]) return [];
      if (part === 'year') {
        yearDigits = segment.text;
      } else if (part === 'day') {
        const value = Number(segment.text);
        if (!validDay(value)) return [];
        day = value;
      } else {
        const value = Number(segment.text);
        if (!validMonth(value)) return [];
        months = [value];
      }
      spans[part] = [segment.start, segment.end];
      slot += 1;
      continue;
    }

    // Free run: fill this part and spill the rest into the next one.
    let offset = 0;
    while (offset < segment.text.length) {
      if (slot >= order.length) return [];

      const current = order[slot];
      const remaining = segment.text.length - offset;

      if (current === 'year') {
        if (remaining > PART_CAP.year) return [];
        yearDigits = segment.text.slice(offset, offset + remaining);
        spans.year = [segment.start + offset, segment.start + offset + remaining];
        offset += remaining;
        slot += 1;
        break;
      }

      let take = Math.min(PART_CAP[current], remaining);
      if (take === 2 && !validDayOrMonth(current, Number(segment.text.slice(offset, offset + 2)))) {
        take = 1;
      }
      const value = Number(segment.text.slice(offset, offset + take));
      if (!validDayOrMonth(current, value)) return [];

      if (current === 'day') day = value;
      else months = [value];
      spans[current] = [segment.start + offset, segment.start + offset + take];

      offset += take;
      slot += 1;
    }
  }

  const base = { endianness, day, spans, segmentCount: segments.length };

  // Missing a whole part: exposed so "not enough information" has something to
  // show, but never a date (FR-14).
  if (day === null || months === null) {
    return [
      {
        ...base,
        month: months ? months[0] : null,
        complete: false,
        year: null,
        yearPrefix: null,
        iso: null,
      },
    ];
  }

  const readings = [];
  for (const month of months) {
    readings.push(...readingsForYear({ base, month, yearDigits, range }));
  }
  return readings;
}

function validDayOrMonth(part, value) {
  return part === 'day' ? validDay(value) : validMonth(value);
}

function readingsForYear({ base, month, yearDigits, range }) {
  const { day } = base;

  const partial = (yearPrefix) => ({
    ...base,
    month,
    complete: false,
    year: null,
    yearPrefix,
    iso: null,
  });

  const complete = (year) => ({
    ...base,
    month,
    complete: true,
    year,
    yearPrefix: null,
    iso: isoOf(year, month, day),
  });

  const usable = (year) => isValidDate(year, month, day) && isIsoInRange(isoOf(year, month, day), range);

  if (!yearDigits) {
    if (!dateExistsWithoutYear(day, month, range)) return [];
    return [partial(null)];
  }

  if (yearDigits.length === 4) {
    const year = Number(yearDigits);
    return usable(year) ? [complete(year)] : [];
  }

  // A run of 1…3 digits is a year number: every in-range year ending with those
  // digits is a reading and the closest to today is the preferred one (FR-13).
  // `5` means 05, so the candidate step is a century (C17).
  const endings = suffixYears(yearDigits, range).filter(usable);
  if (endings.length > 0) return endings.map(complete);

  // No in-range year ends that way, so the run is still being typed: it stays a
  // prefix of a four-digit year while one of those is in range (FR-10).
  const prefixes = completionYears(yearDigits, range).filter(usable);
  if (prefixes.length === 0) return [];

  return [partial(commonYearPrefix(prefixes))];
}

/** The digits every surviving completion agrees on — what may be shown. */
function commonYearPrefix(years) {
  let prefix = String(years[0]).padStart(4, '0');
  for (const year of years) {
    const text = String(year).padStart(4, '0');
    let index = 0;
    while (index < prefix.length && prefix[index] === text[index]) index += 1;
    prefix = prefix.slice(0, index);
  }
  return prefix.slice(0, 3);
}
