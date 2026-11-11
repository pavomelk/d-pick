// §7 group 7 — status vocabulary and feedback text
// (FR-19, FR-20, FR-21, FR-22).

import test from 'node:test';
import assert from 'node:assert/strict';

import { parse } from '../src/parse.js';
import { selectReading } from '../src/format.js';
import { base } from './helpers/options.js';

const p = (value, overrides) => parse(value, base(overrides));

test('FR-20: a complete reading is shown with month names and its order', () => {
  const little = p('25524');
  assert.equal(little.text, '25 May 2024');
  assert.equal(little.endianness, 'little');

  const middle = p('52524');
  assert.equal(middle.text, 'May 25, 2024');
  assert.equal(middle.endianness, 'middle');
});

test('FR-20: a missing part shows an ellipsis in its position', () => {
  assert.equal(p('5/25').text, 'May 25 …');
  assert.equal(p('255').text, '25 May …');
  assert.equal(p('25 sep').text, '25 September …');
});

test('FR-20: an unfinished year shows the prefix its completions share', () => {
  // Only when no in-range year can end with the run: `202` would have to be
  // 1202 or 2202, so the run is still being typed.
  assert.equal(p('25 May 202').text, '25 May 202…');
  assert.equal(p('25 May 202').status, 'partial');
  // A short year that does resolve is a year, not an unfinished one.
  assert.equal(p('2552').text, '25 May 2002');
  assert.equal(p('25 May 2').text, '25 May 2002');
  assert.equal(p('5252').text, 'May 25, 2002');
});

test('FR-20/FR-22: spans and parts describe the presented reading only', () => {
  const partial = p('25 May 202');
  assert.equal(partial.status, 'partial');
  assert.deepEqual(partial.parts, { day: 25, month: 5, year: null });
  assert.deepEqual(partial.spans, { day: [0, 2], month: [3, 6], year: [7, 10] });
  assert.equal(partial.date, null);
  assert.equal(partial.index, 0);
});

test('FR-21: every status is reachable and machine readable', () => {
  assert.equal(p('').status, 'empty');
  assert.equal(p('   ').status, 'empty');
  assert.equal(p('2').status, 'undetermined');
  assert.equal(p('255').status, 'partial');
  assert.equal(p('25524').status, 'complete');
  assert.equal(p('5/5/05', { range: { from: '1900-01-01', to: 'now' } }).status, 'ambiguous');
  assert.equal(p('xyz').status, 'invalid');
  assert.equal(
    p('31122019', { range: { from: '2020-01-01', to: '2020-12-31' } }).status,
    'out-of-range',
  );
});

test('FR-21: an empty value has no reading at all', () => {
  const empty = p('');
  assert.equal(empty.text, '');
  assert.equal(empty.date, null);
  assert.equal(empty.endianness, null);
  assert.equal(empty.index, -1);
  assert.deepEqual(empty.readings, []);
});

test('FR-20: undetermined and invalid values are "Not enough information"', () => {
  for (const value of ['2', '25/345']) {
    const result = p(value);
    assert.equal(result.text, 'Not enough information', value);
    assert.equal(result.date, null, value);
  }
});

test('FR-20/AC-11: an out-of-range value says so and keeps no date', () => {
  const result = p('31122019', { range: { from: '2020-01-01', to: '2020-12-31' } });
  assert.equal(result.status, 'out-of-range');
  assert.equal(result.text, 'Date out of range');
  assert.equal(result.date, null);
});

test('FR-20/C25: a determined month with no other part is shown alone', () => {
  assert.equal(p('N').text, 'November');
  assert.equal(p('J').text, 'June');
});

test('AC-7/FR-14: undetermined keeps its surviving reading exposed', () => {
  const result = p('25');
  assert.equal(result.status, 'undetermined');
  assert.equal(result.readings.length, 1);
  // A reading missing a whole part is exposed too, but never as a date.
  assert.ok(result.readings.some((reading) => reading.month == null));
});

test('FR-22: the structured result is a plain, serialisable object', () => {
  const result = p('25524');
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
});

test('FR-30/AC-31: numeric parts keep the typed digits and months add their name', () => {
  const result = parse('2 4 52', {
    range: { from: '1900-01-01', to: '2000-12-31' },
    now: '2026-11-04',
  });
  assert.equal(result.text, '2 April 1952');
  assert.equal(result.highlighted, '<em>2</em>&nbsp;<em>4</em>(April)&nbsp;19<em>52</em>');

  assert.equal(
    p('25/5/2024').highlighted,
    '<em>25</em>&nbsp;<em>5</em>(May)&nbsp;<em>2024</em>',
  );
  assert.equal(
    p('5/25/2024').highlighted,
    '<em>5</em>(May)&nbsp;<em>25</em>,&nbsp;<em>2024</em>',
  );
});

test('FR-30/AC-31: a typed month prefix is emphasized inside the month name', () => {
  assert.equal(p('ja').highlighted, '<em>Ja</em>nuary');
  assert.equal(p('N').highlighted, '<em>N</em>ovember');
  assert.equal(p('J').highlighted, '<em>J</em>une');
  assert.equal(selectReading(p('J'), 1).highlighted, '<em>J</em>uly');
});

test('FR-30/AC-31: short years emphasize the suffix and partial years their prefix', () => {
  assert.equal(
    p('25524').highlighted,
    '<em>25</em>&nbsp;<em>5</em>(May)&nbsp;20<em>24</em>',
  );
  assert.equal(
    p('25 May 202').highlighted,
    '<em>25</em>&nbsp;<em>May</em>&nbsp;<em>202</em>…',
  );
  assert.equal(p('25 Sep').highlighted, '<em>25</em>&nbsp;<em>Sep</em>tember&nbsp;…');
});

test('FR-30/AC-31: the selected reading supplies the highlighted date', () => {
  const result = parse('5/5/05', { range: { from: '1900-01-01', to: 'now' }, now: '2026-11-04' });
  assert.equal(
    selectReading(result, 1).highlighted,
    '<em>5</em>&nbsp;<em>5</em>(May)&nbsp;19<em>05</em>',
  );
});

test('FR-30: message statuses have no highlighted date', () => {
  const cases = [
    ['', undefined],
    ['25', undefined],
    ['xyz', undefined],
    ['31122019', { range: { from: '2020-01-01', to: '2020-12-31' } }],
  ];
  for (const [value, overrides] of cases) {
    assert.equal(p(value, overrides).highlighted, '', value);
  }
});
