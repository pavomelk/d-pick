// §7 group 5 — month names, abbreviations, prefixes and ambiguous prefixes
// (FR-3, FR-9, FR-14, AC-12, AC-23).

import test from 'node:test';
import assert from 'node:assert/strict';

import { selectReading } from '../src/format.js';
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

test('AC-12/C25: a prefix matching two months is partial while the year is open', () => {
  const result = p('25 ju');
  assert.equal(result.status, 'partial');
  assert.equal(result.text, '25 June …');
  assert.deepEqual(
    result.readings.map((reading) => reading.month),
    [6, 7],
  );
});

test('AC-23: a unique month prefix is presented immediately', () => {
  const november = p('N');
  assert.equal(november.status, 'partial');
  assert.equal(november.text, 'November');
  assert.equal(november.date, null);

  const withDay = p('N 25');
  assert.equal(withDay.status, 'partial');
  assert.equal(withDay.text, 'November 25 …');
  assert.equal(p('N 25 2024').status, 'complete');
  assert.equal(p('N 25 2024').text, 'November 25, 2024');
});

test('AC-23/C25: J presents June, July, then January', () => {
  const result = p('J');
  assert.equal(result.status, 'partial');
  assert.equal(result.text, 'June');
  assert.deepEqual(
    result.readings.map((reading) => reading.month),
    [6, 7, 1],
  );

  const july = selectReading(result, 1);
  assert.equal(july.index, 1);
  assert.equal(july.text, 'July (2 of 3)');
  assert.equal(july.date, null);

  const january = selectReading(result, 2);
  assert.equal(january.index, 2);
  assert.equal(january.text, 'January (3 of 3)');
});

test('AC-23/C25: Ju keeps June preferred and July as the next reading', () => {
  const result = p('Ju 25');
  assert.equal(result.status, 'partial');
  assert.equal(result.text, 'June 25 …');
  assert.deepEqual(
    result.readings.map((reading) => reading.month),
    [6, 7],
  );
  assert.equal(selectReading(result, 1).text, 'July 25 … (2 of 2)');
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
