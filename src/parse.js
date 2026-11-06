// The pure entry point (FR-1, FR-18, FR-21).
//
// `parse(value, options)` returns everything the component (or a test) needs
// to know about one value, and nothing else: no DOM, no clock, no globals.
// `now` is resolved once per call, so a caller can freeze it.

import { isoOf, parseIsoDate, todayIso } from './dates.js';
import { NOT_ENOUGH, OUT_OF_RANGE, selectReading } from './format.js';
import { scan } from './scan.js';
import { readingsFor } from './shapes.js';

const DEFAULT_MAX_READINGS = 8;

export function normaliseNow(now) {
  if (now === undefined || now === null) return todayIso();

  if (now instanceof Date) {
    if (Number.isNaN(now.getTime())) throw new TypeError('Invalid now Date');
    return isoOf(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }

  if (typeof now === 'string') {
    const parsed = parseIsoDate(now);
    if (parsed) return isoOf(parsed.year, parsed.month, parsed.day);
  }

  throw new TypeError(`Invalid now: ${String(now)}`);
}

function resolveBound(bound, nowIso, name) {
  if (bound === undefined || bound === null || bound === '') return null;
  if (bound === 'now') return nowIso;
  if (typeof bound === 'string') {
    const parsed = parseIsoDate(bound);
    if (parsed) return isoOf(parsed.year, parsed.month, parsed.day);
  }
  throw new TypeError(`Invalid range.${name}: ${String(bound)}`);
}

export function resolveRange(range, nowIso = todayIso()) {
  const source = range || {};
  const from = resolveBound(source.from, nowIso, 'from');
  const to = resolveBound(source.to, nowIso, 'to');
  if (from && to && from > to) {
    throw new TypeError(`Range start ${from} is after its end ${to}`);
  }
  return { from, to };
}

function distanceFrom(year, nowYear) {
  return Math.abs(year - nowYear);
}

function compareReadings(left, right, nowYear) {
  if (left.endianness !== right.endianness) return left.endianness === 'little' ? -1 : 1;
  if (left.complete !== right.complete) return left.complete ? -1 : 1;

  if (left.complete && right.complete) {
    const distance = distanceFrom(left.year, nowYear) - distanceFrom(right.year, nowYear);
    if (distance !== 0) return distance;
  }

  if (left.segmentCount !== right.segmentCount) return left.segmentCount - right.segmentCount;
  if (left.monthRank !== right.monthRank) {
    return (left.monthRank || 0) - (right.monthRank || 0);
  }
  if (left.month !== right.month) return (left.month || 0) - (right.month || 0);
  if (left.day !== right.day) return (left.day || 0) - (right.day || 0);
  if (left.year !== right.year) return (left.year || 0) - (right.year || 0);
  return 0;
}

function readingKey(reading) {
  return [
    reading.endianness,
    reading.complete,
    reading.day,
    reading.month,
    reading.year,
    reading.yearPrefix || '',
  ].join('|');
}

/** Little-endian readings suppress the middle-endian ones (FR-12). */
function present(readings, nowYear) {
  const little = readings.filter((reading) => reading.endianness === 'little');
  const surviving = little.length > 0 ? little : readings;

  const sorted = [...surviving].sort((left, right) => compareReadings(left, right, nowYear));
  const seen = new Set();
  return sorted.filter((reading) => {
    const key = readingKey(reading);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parse(value, options = {}) {
  const nowIso = normaliseNow(options.now);
  const range = resolveRange(options.range, nowIso);
  const requested = Number(options.maxReadings);
  const maxReadings =
    Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : DEFAULT_MAX_READINGS;
  const nowYear = Number(nowIso.slice(0, 4));

  const raw = value === undefined || value === null ? '' : String(value);
  const scanned = scan(raw);

  let status;
  let readings = [];

  if (!scanned.ok) {
    status = 'invalid';
  } else if (scanned.empty) {
    status = 'empty';
  } else {
    readings = present(readingsFor(scanned, range), nowYear);

    if (readings.length === 0) {
      // Distinguish "no in-range date" from "not a date at all" (FR-22):
      // the same value read with no bounds tells them apart.
      const unbounded = present(readingsFor(scanned, { from: null, to: null }), nowYear);
      status = unbounded.length > 0 ? 'out-of-range' : 'invalid';
    } else if (readings.length === 1) {
      const only = readings[0];
      if (only.complete) status = 'complete';
      else if (only.month !== null) status = 'partial';
      else status = 'undetermined';
    } else if (readings.every((reading) => reading.complete)) {
      status = 'ambiguous';
    } else {
      // A determined month is enough to present the best partial reading;
      // undetermined means no presented reading can name the month (FR-14).
      status = readings.some((reading) => reading.month !== null) ? 'partial' : 'undetermined';
    }
  }

  const visible = readings.slice(0, maxReadings);
  const base = {
    value: raw,
    status,
    readings: visible,
    // Navigation is offered only for a list small enough to walk (C14).
    navigable: visible.length > 1 && readings.length <= maxReadings,
    index: visible.length > 0 ? 0 : -1,
    text: '',
    date: null,
    endianness: null,
    parts: null,
    spans: null,
  };

  if (status === 'empty') return { ...base, text: '' };
  if (visible.length === 0) {
    return { ...base, text: status === 'out-of-range' ? OUT_OF_RANGE : NOT_ENOUGH };
  }

  return selectReading(base, 0);
}

/** `parse` as a function of a fixed clock and range — handy for tests. */
export function createParser(options = {}) {
  const nowIso = normaliseNow(options.now);
  const range = resolveRange(options.range, nowIso);
  const maxReadings = options.maxReadings;
  return (value) => parse(value, { range, now: nowIso, maxReadings });
}
