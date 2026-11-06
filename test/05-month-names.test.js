// §7 group 5 — month names, abbreviations, prefixes and ambiguous prefixes
// (FR-3, FR-9, AC-12).

import test from 'node:test';
import assert from 'node:assert/strict';

import { parse } from '../src/parse.js';
import { base } from './helpers/options.js';

const p = (value, overrides) => parse(value, base(overrides));

test('AC-12: a full month name and its abbreviation are recognized', () => {
  const abbreviated = p('25 sep');
  assert.equal(abbreviated.status, 'partial');
  assert.equal(abbreviated.text, '25 September …');

  const full = p('25 september 2024');
  assert.equal(full.status, 'complete');
  assert.equal(full.text, '25 September 2024');

  const threeLetters = p('25 sept 2024');
  assert.equal(threeLetters.status, 'complete');
  assert.equal(threeLetters.date, '2024-09-25');
});

test('FR-3: matching is case-insensitive and accepts a typed prefix', () => {
  assert.equal(p('25 SEPT').text, '25 September …');
  assert.equal(p('25 Septem').text, '25 September …');
  assert.equal(p('25 September 2024').text, '25 September 2024');
});

test('FR-3: letters a run cannot resolve make the value invalid', () => {
  assert.equal(p('xyz').status, 'invalid');
  assert.equal(p('25 mayy 2024').status, 'invalid');
  assert.deepEqual(p('xyz').readings, []);
});

test('AC-12: a prefix matching two months stays undetermined while the year is open', () => {
  const result = p('25 ju');
  assert.equal(result.status, 'undetermined');
  assert.equal(result.text, 'Not enough information');
  assert.deepEqual(
    result.readings.map((reading) => reading.month),
    [6, 7],
  );
});

test('FR-9: once the year is known the two months are complete alternatives', () => {
  const result = p('25 ju 2024');
  assert.equal(result.status, 'ambiguous');
  assert.deepEqual(
    result.readings.map((reading) => reading.iso),
    ['2024-06-25', '2024-07-25'],
  );
  assert.equal(result.text, '25 June 2024');
});

test('FR-9: a one-letter run resolves to every month that starts with it', () => {
  const result = p('25 m 2024');
  assert.equal(result.status, 'ambiguous');
  assert.deepEqual(
    result.readings.map((reading) => reading.iso),
    ['2024-03-25', '2024-05-25'],
  );
});

test('FR-9: a month name can take the month-first position', () => {
  const result = p('may 25, 2024');
  assert.equal(result.status, 'complete');
  assert.equal(result.text, 'May 25, 2024');
  assert.equal(result.readings[0].endianness, 'middle');
});

test('FR-20: the display text round-trips through the parser', () => {
  for (const value of ['25 May 2024', 'May 25, 2024', '25 September 2024']) {
    const result = p(value);
    assert.equal(result.status, 'complete', value);
    assert.equal(result.text, value);
  }
});
