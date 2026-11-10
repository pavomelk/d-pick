// §7 group 1 — segmentation (FR-4, FR-6, FR-7) and the two worked examples
// of the problem statement (AC-1 … AC-10).

import test from 'node:test';
import assert from 'node:assert/strict';

import { parse } from '../src/parse.js';
import { base } from './helpers/options.js';

const p = (value, overrides) => parse(value, base(overrides));

test('AC-1 … AC-5: the month-first walkthrough holds once day-first runs out', () => {
  const one = p('5');
  assert.equal(one.status, 'undetermined');
  assert.equal(one.text, 'Not enough information');
  assert.equal(one.date, null);

  const two = p('52');
  assert.equal(two.status, 'partial');
  assert.equal(two.text, '5 February …');
  assert.equal(two.endianness, 'little');

  // Day 5 is committed, so the rest is month 2 and a short year 5 (2005).
  const three = p('525');
  assert.equal(three.status, 'complete');
  assert.equal(three.text, '5 February 2005');
  assert.equal(three.endianness, 'little');

  // Day-first cannot read `52` as a year (no year in 1972…2026 ends in 52), so
  // the month-first reading is the one left standing.
  const four = p('5252');
  assert.equal(four.status, 'complete');
  assert.equal(four.text, 'May 25, 2002');
  assert.equal(four.endianness, 'middle');

  const five = p('52524');
  assert.equal(five.status, 'complete');
  assert.equal(five.text, 'May 25, 2024');
  assert.equal(five.date, '2024-05-25');
  assert.equal(five.readings.length, 1);
});

test('AC-6 … AC-10: five digits resolve to a little-endian date', () => {
  assert.equal(p('2').status, 'undetermined');
  assert.equal(p('25').status, 'undetermined');

  const three = p('255');
  assert.equal(three.status, 'partial');
  assert.equal(three.text, '25 May …');

  // `2` is the year 02: 1902 is out of range, so 2002.
  const four = p('2552');
  assert.equal(four.status, 'complete');
  assert.equal(four.text, '25 May 2002');
  assert.equal(four.date, '2002-05-25');

  const five = p('25524');
  assert.equal(five.status, 'complete');
  assert.equal(five.text, '25 May 2024');
  assert.equal(five.date, '2024-05-25');
  assert.equal(five.endianness, 'little');
});

test('AC-25: 05 is day 5 until the year position', () => {
  const leading = p('05');
  assert.equal(leading.status, 'undetermined');
  assert.equal(leading.text, 'Not enough information');

  const complete = p('25 5 05');
  assert.equal(complete.status, 'complete');
  assert.equal(complete.date, '2005-05-25');
});

test('FR-7/FR-22: the structured result exposes parts and digit spans', () => {
  const result = p('25524');
  assert.deepEqual(result.parts, { day: 25, month: 5, year: 2024 });
  assert.deepEqual(result.spans, { day: [0, 2], month: [2, 3], year: [3, 5] });

  const withName = parse('25 May 2024', base());
  assert.equal(withName.status, 'complete');
  assert.deepEqual(withName.spans, { day: [0, 2], month: [3, 6], year: [7, 11] });
});

test('AC-13: separators are hard boundaries and are never re-split', () => {
  assert.equal(p('25/5/2024').status, 'complete');
  assert.equal(p('25/5/2024').text, '25 May 2024');

  const dotted = p('5.25.2024');
  assert.equal(dotted.status, 'complete');
  assert.equal(dotted.text, 'May 25, 2024');
  assert.equal(dotted.endianness, 'middle');

  const dashed = p('25-5-24');
  assert.equal(dashed.status, 'complete');
  assert.equal(dashed.text, '25 May 2024');

  const pinned = p('255/24');
  assert.equal(pinned.status, 'invalid');
  assert.equal(pinned.text, 'Not enough information');
  assert.deepEqual(pinned.readings, []);
});

test('FR-4: a trailing separator pins the run but does not join segments', () => {
  // `25` is a single, closed digit segment, so the month is still missing.
  const trailing = p('25/');
  assert.equal(trailing.status, 'undetermined');
  assert.equal(trailing.text, 'Not enough information');

  const shortDay = p('25/5');
  assert.equal(shortDay.status, 'partial');
  assert.equal(shortDay.text, '25 May …');

  const monthFirst = p('5/25');
  assert.equal(monthFirst.status, 'partial');
  assert.equal(monthFirst.text, 'May 25 …');
  assert.equal(monthFirst.endianness, 'middle');
});

test('FR-4: a digit↔letter transition ends a segment without a separator', () => {
  const glued = p('25may2024');
  assert.equal(glued.status, 'complete');
  assert.equal(glued.text, '25 May 2024');

  const monthOnly = p('25May');
  assert.equal(monthOnly.status, 'partial');
  assert.equal(monthOnly.text, '25 May …');
});

test('FR-2: whitespace around the value is ignored, separators inside are not', () => {
  const padded = p('  25 May 2024  ');
  assert.equal(padded.status, 'complete');
  assert.equal(padded.text, '25 May 2024');
});

test('FR-6: separators are interchangeable, space included', () => {
  for (const value of [
    '25.5.2024',
    '25-5-2024',
    '25/5/2024',
    '25 5 2024',
    '25.5/2024',
    '25 - 5 - 2024',
  ]) {
    const result = p(value);
    assert.equal(result.status, 'complete', value);
    assert.equal(result.date, '2024-05-25', value);
  }
});

test('C16: the assumed order is committed, one digit at a time', () => {
  // `1` could still grow to 12, so nothing is decided yet.
  assert.equal(p('1').status, 'undetermined');
  // Two valid digits fill the day and are not re-split later.
  assert.equal(p('12').status, 'undetermined');
  assert.equal(p('122').text, '12 February …');
  assert.equal(p('1225').date, '2005-02-12');
  // A single digit that cannot start a valid day keeps the part open.
  assert.equal(p('52').text, '5 February …');
  assert.equal(p('112').text, '11 February …');
});

test('C16: a space or a leading zero steers the same digits', () => {
  assert.equal(p('1225').date, '2005-02-12');
  assert.equal(p('12 2 5').date, '2005-02-12');
  assert.equal(p('1 2 25').date, '2025-02-01');
  assert.equal(p('12 2 05').date, '2005-02-12');
  // `02305`: the leading zero fills the day with two digits, so the cut is
  // 02|3|05 rather than 0|23|05.
  assert.equal(p('02305').date, '2005-03-02');
  assert.equal(p('2 5 23').date, '2023-05-02');
});

test('C17: a short year is a year number completed to the nearest century', () => {
  // `5` is 05: 1905 and 2005 are the candidates, and 2005 is in range.
  assert.equal(p('1225').text, '12 February 2005');
  assert.equal(p('525').text, '5 February 2005');
  // In year position: `95` is 1995, `952` is 1952, both nearest to today.
  assert.equal(p('25 5 95').date, '1995-05-25');
  assert.equal(p('25 5 952', { range: { from: '1900-01-01', to: 'now' } }).date, '1952-05-25');
  // A run that no in-range year ends with stays an unfinished year instead.
  assert.equal(p('25 May 202').status, 'partial');
  assert.equal(p('25 May 202').text, '25 May 202…');
});

test('C28: Tab is not a separator', () => {
  const result = p('25\t5\t2024');
  assert.equal(result.status, 'invalid');
  assert.deepEqual(result.readings, []);
});
