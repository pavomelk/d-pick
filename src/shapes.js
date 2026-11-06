// Tokens → readings (FR-4 … FR-13).
//
// Splitting and reading are separate: `splits` produces the ways the value
// can be cut into parts, and `readSegments` reads one cut under one
// endianness. Every reading is a candidate date, complete or still open;
// readings whose day and month already exist are dropped as soon as no
// in-range completion remains (FR-11).

import { daysInMonth, isoOf, isValidDate } from './dates.js';
import {
  centuryYears,
  completionYears,
  dateExistsWithoutYear,
  isIsoInRange,
} from './exists.js';
import { MONTH_NAMES } from './format.js';

const PART_ORDER = {
  little: ['day', 'month', 'year'],
  middle: ['month', 'day', 'year'],
};

// Positional length caps for a free split: day and month at most 2, year 4.
const MAX_PART_LENGTH = [2, 2, 4];

export function readingsFor(scanned, range) {
  if (!scanned.ok || scanned.empty) return [];

  const readings = [];
  for (const segments of splits(scanned)) {
    for (const endianness of ['little', 'middle']) {
      readings.push(...readSegments(segments, endianness, range));
    }
  }
  return readings;
}

function splits(scanned) {
  // Separators pin the cuts (FR-6): the segments are the only split.
  if (!scanned.free) return scanned.segments.length <= 3 ? [scanned.segments] : [];

  const run = scanned.segments[0];
  const results = [];

  for (let count = 1; count <= 3; count += 1) {
    const lengths = new Array(count).fill(1);

    const collect = (index, remaining) => {
      if (index === lengths.length) {
        if (remaining === 0) results.push(cutRun(run, lengths));
        return;
      }
      const slotsAfter = lengths.length - index - 1;
      const longest = Math.min(MAX_PART_LENGTH[index], remaining - slotsAfter);
      for (let length = 1; length <= longest; length += 1) {
        lengths[index] = length;
        collect(index + 1, remaining - length);
      }
    };

    collect(0, run.text.length);
  }

  return results;
}

function cutRun(run, lengths) {
  const segments = [];
  let offset = 0;
  for (const length of lengths) {
    segments.push({
      kind: 'digit',
      text: run.text.slice(offset, offset + length),
      start: run.start + offset,
      end: run.start + offset + length,
    });
    offset += length;
  }
  return segments;
}

function spanOf(segment) {
  return segment ? [segment.start, segment.end] : null;
}

function monthsMatching(text) {
  const prefix = text.toLowerCase();
  const months = [];
  MONTH_NAMES.forEach((name, index) => {
    if (name.toLowerCase().startsWith(prefix)) months.push(index + 1);
  });
  return months;
}

function readSegments(segments, endianness, range) {
  const order = PART_ORDER[endianness];
  if (segments.length > order.length) return [];

  const assigned = {};
  segments.forEach((segment, index) => {
    assigned[order[index]] = segment;
  });

  const daySegment = assigned.day || null;
  const monthSegment = assigned.month || null;
  const yearSegment = assigned.year || null;

  if (daySegment && daySegment.kind !== 'digit') return [];
  if (yearSegment && yearSegment.kind !== 'digit') return [];

  let day = null;
  if (daySegment) {
    if (daySegment.text.length > 2) return [];
    day = Number(daySegment.text);
    if (day < 1 || day > 31) return [];
  }

  let months = [null];
  if (monthSegment) {
    if (monthSegment.kind === 'letter') {
      months = monthsMatching(monthSegment.text);
      if (months.length === 0) return [];
    } else {
      if (monthSegment.text.length > 2) return [];
      const month = Number(monthSegment.text);
      if (month < 1 || month > 12) return [];
      months = [month];
    }
  }

  const spans = {
    day: spanOf(daySegment),
    month: spanOf(monthSegment),
    year: spanOf(yearSegment),
  };

  const readings = [];
  for (const month of months) {
    readings.push(
      ...readParts({
        endianness,
        day,
        month,
        yearSegment,
        spans,
        segmentCount: segments.length,
        range,
      }),
    );
  }
  return readings;
}

function readParts({ endianness, day, month, yearSegment, spans, segmentCount, range }) {
  const base = { endianness, day, month, spans, segmentCount, year: null, yearPrefix: null, iso: null };

  // Missing a whole part: exposed, so "not enough information" has something
  // to show, but never a date.
  if (day === null || month === null) return [{ ...base, complete: false }];

  if (!yearSegment) {
    if (!dateExistsWithoutYear(day, month, range)) return [];
    return [{ ...base, complete: false }];
  }

  const digits = yearSegment.text;

  if (digits.length === 2) {
    const years = centuryYears(digits, range).filter((year) => isValidDate(year, month, day));
    if (years.length === 0) return [];
    return years.map((year) => ({
      ...base,
      complete: true,
      year,
      iso: isoOf(year, month, day),
    }));
  }

  if (digits.length === 4) {
    const year = Number(digits);
    if (!isValidDate(year, month, day)) return [];
    const iso = isoOf(year, month, day);
    if (!isIsoInRange(iso, range)) return [];
    return [{ ...base, complete: true, year, iso }];
  }

  // One or three digits: an unfinished year. It survives while some
  // four-digit completion is in range (FR-10, C15).
  const years = completionYears(digits, range).filter((year) => {
    if (day > daysInMonth(year, month)) return false;
    return isIsoInRange(isoOf(year, month, day), range);
  });
  if (years.length === 0) return [];

  return [{ ...base, complete: false, yearPrefix: commonYearPrefix(years) }];
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
