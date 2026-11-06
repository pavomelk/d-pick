// §7 group 1 — segmentation (FR-4, FR-6, FR-7) and the two worked examples
// of the problem statement (AC-1 … AC-10).

import test from 'node:test';
import assert from 'node:assert/strict';

import { parse } from '../src/parse.js';
import { base } from './helpers/options.js';

const p = (value, overrides) => parse(value, base(overrides));

test('AC-1 … AC-5: five digits resolve to a middle-endian date', () => {
  const one = p('5');
  assert.equal(one.status, 'undetermined');
  assert.equal(one.text, 'Not enough information');
  assert.equal(one.date, null);

  const two = p('52');
  assert.equal(two.status, 'partial');
  assert.equal(two.text, '5 February …');
  assert.equal(two.endianness, 'little');

  const three = p('525');
  assert.equal(three.status, 'partial');
  assert.equal(three.text, 'May 25 …');
  assert.equal(three.endianness, 'middle');

  const four = p('5252');
  assert.equal(four.status, 'partial');
  assert.equal(four.text, 'May 25, 202…');

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

  const four = p('2552');
  assert.equal(four.status, 'partial');
  assert.equal(four.text, '25 May 202…');

  const five = p('25524');
  assert.equal(five.status, 'complete');
  assert.equal(five.text, '25 May 2024');
  assert.equal(five.date, '2024-05-25');
  assert.equal(five.endianness, 'little');
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
