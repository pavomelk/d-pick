// §7 group 4 — century derivation for two-digit years
// (FR-13, AC-19, AC-17's two-digit month/day formats).

import test from 'node:test';
import assert from 'node:assert/strict';

import { parse } from '../src/parse.js';
import { selectReading } from '../src/format.js';
import { base, NOW } from './helpers/options.js';

const p = (value, overrides) => parse(value, base(overrides));

const R_1900 = { range: { from: '1900-01-01', to: 'now' }, now: NOW };
const R_1900_1940 = { range: { from: '1900-01-01', to: '1940-12-31' }, now: NOW };
const R_1990_2010 = { range: { from: '1990-01-01', to: '2010-12-31' }, now: NOW };

test('FR-13: every in-range century survives, the one closest to today first', () => {
  const result = parse('5/5/05', R_1900);
  assert.equal(result.status, 'ambiguous');
  assert.equal(result.text, 'May 5, 2005');
  assert.deepEqual(
    result.readings.map((reading) => reading.iso),
    ['2005-05-05', '1905-05-05'],
  );
  assert.equal(result.readings[0].complete, true);
  assert.equal(result.index, 0);
});

test('FR-13/FR-20: the selected alternative is marked in the feedback', () => {
  const result = parse('5/5/05', R_1900);
  const selected = selectReading(result, 1);
  assert.equal(selected.index, 1);
  assert.equal(selected.text, 'May 5, 1905 (2 of 2)');
  assert.equal(selected.date, '1905-05-05');
  assert.equal(result.readings[1].iso, '1905-05-05');
});

test('FR-13: a century outside the range is dropped instead of offered', () => {
  const result = parse('5/5/05', R_1900_1940);
  assert.equal(result.status, 'complete');
  assert.equal(result.date, '1905-05-05');
  assert.equal(result.text, 'May 5, 1905');
});

test('FR-13: no century in range eliminates the candidate outright', () => {
  const result = parse('5/5/05', {
    range: { from: '1970-01-01', to: '1980-12-31' },
    now: NOW,
  });
  assert.equal(result.status, 'out-of-range');
  assert.deepEqual(result.readings, []);
});

test('FR-13: a two-digit year uses the only century the range leaves', () => {
  const result = parse('1/1/00', R_1990_2010);
  assert.equal(result.status, 'complete');
  assert.equal(result.date, '2000-01-01');
});

test('FR-13: a range leaving two centuries makes the value ambiguous', () => {
  const result = parse('1/1/00', {
    range: { from: '1890-01-01', to: '2005-12-31' },
    now: NOW,
  });
  assert.equal(result.status, 'ambiguous');
  assert.deepEqual(
    result.readings.map((reading) => reading.iso),
    ['2000-01-01', '1900-01-01'],
  );
});

test('FR-13: a two-digit year derives its century from the range', () => {
  const result = p('25-5-24');
  assert.equal(result.status, 'complete');
  assert.equal(result.date, '2024-05-25');
});
