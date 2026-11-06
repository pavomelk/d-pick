// §7 group 2 — endianness preference and "not enough information"
// (FR-12, FR-14, OQ-1, AC-2, AC-7).

import test from 'node:test';
import assert from 'node:assert/strict';

import { parse } from '../src/parse.js';
import { base } from './helpers/options.js';

const p = (value, overrides) => parse(value, base(overrides));

test('FR-12: a surviving little-endian reading suppresses every middle-endian one', () => {
  const result = p('52');
  assert.equal(result.status, 'partial');
  assert.equal(result.text, '5 February …');
  assert.equal(result.readings.length, 1);
  assert.ok(result.readings.every((reading) => reading.endianness === 'little'));

  // `25` keeps two little-endian readings (day 25 alone, day 2 + month 5), so
  // it is "not enough information" rather than a partial date.
  const both = p('25');
  assert.equal(both.status, 'undetermined');
  assert.ok(both.readings.length >= 2);
  assert.ok(both.readings.every((reading) => reading.endianness === 'little'));
});

test('FR-12: little-endian wins even when middle-endian is also complete', () => {
  const result = p('1/2/2024');
  assert.equal(result.status, 'complete');
  assert.equal(result.endianness, 'little');
  assert.equal(result.date, '2024-02-01');
  assert.equal(result.text, '1 February 2024');
});

test('FR-12/OQ-1: preference is absolute, not a plausibility vote', () => {
  // `1225` can be 1 February 2025 (little) or December 25 … (middle).
  const result = p('1225');
  assert.equal(result.status, 'complete');
  assert.equal(result.endianness, 'little');
  assert.equal(result.date, '2025-02-01');
  assert.equal(result.text, '1 February 2025');
});

test('FR-12: middle-endian appears only once every little-endian reading is gone', () => {
  const result = p('525');
  assert.equal(result.endianness, 'middle');
  assert.ok(result.readings.every((reading) => reading.endianness === 'middle'));
});

test('FR-12: an impossible little-endian reading lets middle-endian through', () => {
  const result = p('5/25/2024');
  assert.equal(result.status, 'complete');
  assert.equal(result.endianness, 'middle');
  assert.equal(result.date, '2024-05-25');
  assert.equal(result.text, 'May 25, 2024');
});

test('FR-14: one preferred reading that is missing its year is partial', () => {
  const result = p('25 sep');
  assert.equal(result.status, 'partial');
  assert.equal(result.text, '25 September …');
  assert.equal(result.date, null);
  assert.equal(result.parts.year, null);
});

test('FR-14: a reading missing a whole part is not presented as a date', () => {
  const result = p('5');
  assert.equal(result.status, 'undetermined');
  assert.equal(result.date, null);
  assert.ok(result.readings.every((reading) => reading.month == null || reading.day == null));
});
