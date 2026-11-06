// §7 group 3 — range elimination and range configuration
// (FR-11, FR-18, AC-11, AC-20's frozen `now`).

import test from 'node:test';
import assert from 'node:assert/strict';

import { parse, resolveRange } from '../src/parse.js';
import { base, NOW } from './helpers/options.js';

const p = (value, overrides) => parse(value, base(overrides));

const R_2020 = { range: { from: '2020-01-01', to: '2020-12-31' } };
const R_2021_2023 = { range: { from: '2021-01-01', to: '2023-12-31' } };

test('FR-18: bounds resolve to ISO dates, `now` included', () => {
  assert.deepEqual(resolveRange({ from: '1972-02-05', to: 'now' }, NOW), {
    from: '1972-02-05',
    to: '2026-11-04',
  });
  assert.deepEqual(resolveRange({ to: 'now' }, '2027-01-01'), { from: null, to: '2027-01-01' });
  assert.deepEqual(resolveRange({ from: '1972-02-05' }, NOW), {
    from: '1972-02-05',
    to: null,
  });
  assert.deepEqual(resolveRange({}, NOW), { from: null, to: null });
});

test('FR-18: a range whose bounds cross is rejected at construction', () => {
  assert.throws(
    () => resolveRange({ from: '2024-05-25', to: '2024-05-24' }, NOW),
    TypeError,
  );
  assert.throws(
    () => parse('25524', { range: { from: '2024-05-25', to: '2024-05-24' }, now: NOW }),
    TypeError,
  );
});

test('AC-11: a well-formed date outside the range is out-of-range, not invalid', () => {
  const excluded = p('31122019', R_2020);
  assert.equal(excluded.status, 'out-of-range');
  assert.equal(excluded.date, null);
  assert.equal(excluded.text, 'Date out of range');
  assert.deepEqual(excluded.readings, []);

  const included = p('311220', R_2020);
  assert.equal(included.status, 'complete');
  assert.equal(included.date, '2020-12-31');
  assert.equal(included.text, '31 December 2020');
});

test('FR-11: bounds are inclusive', () => {
  // Day 25 on purpose: with both numbers ≤ 12 the value keeps a middle-endian
  // reading (FR-12), which would rescue a day that the range drops.
  assert.equal(p('25/2/1972').status, 'complete');
  assert.equal(p('25/2/1972').date, '1972-02-25');
  assert.equal(p('25/1/1972').status, 'out-of-range');
  assert.equal(p('25/10/2026').status, 'complete');
  assert.equal(p('25/10/2026').date, '2026-10-25');
  assert.equal(p('25/11/2026').status, 'out-of-range');
});

test('FR-18: an unbounded side does not filter anything', () => {
  assert.equal(p('31122019', { range: {} }).status, 'complete');
  assert.equal(p('31122019', { range: { from: '1972-02-05' } }).status, 'complete');
  assert.equal(p('31122019', { range: { to: 'now' } }).status, 'complete');
});

test('FR-11: an unfinished year survives only while a completion is in range', () => {
  const oneYear = p('25 May 2', R_2020);
  assert.equal(oneYear.status, 'partial');
  assert.equal(oneYear.text, '25 May 202…');

  // A one-digit year is a year number (C17): `9` is 1999 here, because the
  // range leaves no other year ending in 9.
  const nineteenNineties = p('25 May 9', {
    range: { from: '1990-01-01', to: '2010-12-31' },
  });
  // `9` is the year 09, so the only year in 1990…2010 ending in 09 is 2009.
  assert.equal(nineteenNineties.status, 'complete');
  assert.equal(nineteenNineties.date, '2009-05-25');

  const beforeTwoThousands = p('25 May 2', {
    range: { from: '1972-02-05', to: '1999-12-31' },
  });
  assert.equal(beforeTwoThousands.status, 'out-of-range');
});

test('FR-11: day and month existence is checked against the surviving years', () => {
  const leapAvailable = p('29/2/2');
  assert.equal(leapAvailable.status, 'partial');
  assert.equal(leapAvailable.text, '29 February 202…');

  const noLeapYear = p('29/2/2', R_2021_2023);
  assert.equal(noLeapYear.status, 'out-of-range');
  assert.deepEqual(noLeapYear.readings, []);
});

test('FR-8/FR-21: an impossible calendar date is invalid, not out-of-range', () => {
  assert.equal(p('31/2/2024').status, 'invalid');
  assert.equal(p('29/2/2023').status, 'invalid');
});
