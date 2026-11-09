// §7 group 8 — reading list order, ArrowDown/ArrowUp and the Enter matrix
// (FR-15, FR-16, AC-15, AC-16, AC-19).

import test from 'node:test';
import assert from 'node:assert/strict';

import { parse } from '../src/parse.js';
import { base, NOW } from './helpers/options.js';
import { setup } from './helpers/setup.js';

const R_1900 = { range: { from: '1900-01-01', to: 'now' }, now: NOW };

test('FR-15: the list is best-first and says whether it can be walked', () => {
  const result = parse('5/5/05', R_1900);
  assert.deepEqual(
    result.readings.map((reading) => reading.iso),
    ['2005-05-05', '1905-05-05'],
  );
  assert.equal(result.navigable, true);

  const single = parse('25524', base());
  assert.equal(single.readings.length, 1);
  assert.equal(single.navigable, false);
});

test('FR-15: ArrowDown/ArrowUp walk the list, wrap, and never touch the text', () => {
  const { textInput, feedback } = setup(R_1900);
  textInput.type('5/5/05');
  assert.equal(feedback.textContent, 'May 5, 2005');

  textInput.key('ArrowDown');
  assert.equal(feedback.textContent, 'May 5, 1905 (2 of 2)');
  assert.equal(textInput.value, '5/5/05');

  textInput.key('ArrowDown');
  assert.equal(feedback.textContent, 'May 5, 2005');

  textInput.key('ArrowUp');
  assert.equal(feedback.textContent, 'May 5, 1905 (2 of 2)');

  textInput.key('ArrowUp');
  assert.equal(feedback.textContent, 'May 5, 2005');
});

test('C25: ArrowDown walks an ambiguous month prefix from June to July', () => {
  const { textInput, dateInput, feedback } = setup();
  textInput.type('J');
  assert.equal(feedback.textContent, 'June');

  textInput.key('ArrowDown');
  assert.equal(feedback.textContent, 'July (2 of 3)');
  assert.equal(textInput.value, 'J');
  assert.equal(dateInput.value, '');
});

test('FR-15: navigation is off above maxReadings, so the key stays native', () => {
  const { textInput, feedback } = setup({ ...R_1900, maxReadings: 1 });
  textInput.type('5/5/05');
  const event = textInput.key('ArrowDown');
  assert.equal(feedback.textContent, 'May 5, 2005');
  assert.equal(event.defaultPrevented, false);
});

test('FR-15: with a single reading the arrow keys keep their native effect', () => {
  const { textInput } = setup();
  textInput.type('25524');
  const event = textInput.key('ArrowDown');
  assert.equal(event.defaultPrevented, false);
});

test('FR-22: onReadingChange follows the selection', () => {
  const { textInput, readingChanges } = setup(R_1900);
  textInput.type('5/5/05');
  const before = readingChanges.length;
  textInput.key('ArrowDown');
  assert.equal(readingChanges.length, before + 1);
  assert.equal(readingChanges.at(-1).index, 1);
  assert.equal(readingChanges.at(-1).text, 'May 5, 1905 (2 of 2)');
});

test('FR-16: Enter confirms a complete reading and rewrites the field', () => {
  const { textInput, dateInput, confirmed } = setup();
  textInput.type('25524');
  textInput.key('Enter');
  assert.deepEqual(confirmed, ['2024-05-25']);
  assert.equal(textInput.value, '25 May 2024');
  assert.equal(dateInput.value, '2024-05-25');
});

test('AC-15: Enter proposes today\'s year when day and month are determined', () => {
  const { textInput, dateInput, confirmed } = setup();
  textInput.type('25 Sep');
  textInput.key('Enter');
  assert.deepEqual(confirmed, ['2026-09-25']);
  assert.equal(textInput.value, '25 September 2026');
  assert.equal(dateInput.value, '2026-09-25');
});

test('AC-15: no year is proposed when it would fall outside the range', () => {
  const { textInput, confirmed } = setup({
    range: { from: '1972-02-05', to: '2020-12-31' },
  });
  textInput.type('25 Sep');
  textInput.key('Enter');
  assert.deepEqual(confirmed, []);
  assert.equal(textInput.value, '25 Sep');
});

test('AC-16: a short year is read, an unfinished one is not invented', () => {
  const { textInput, confirmed, dateInput, feedback } = setup();
  // `2` is the year 02, so this is already a complete date and Enter takes it.
  textInput.type('25 May 2');
  assert.equal(feedback.textContent, '25 May 2002');
  textInput.key('Enter');
  assert.deepEqual(confirmed, ['2002-05-25']);
  assert.equal(dateInput.value, '2002-05-25');

  // `202` can only be a prefix (no in-range year ends in 202): Enter does nothing.
  const started = setup();
  started.textInput.type('25 May 202');
  started.textInput.key('Enter');
  assert.deepEqual(started.confirmed, []);
  assert.equal(started.textInput.value, '25 May 202');
  assert.equal(started.dateInput.value, '');
});

test('FR-16: Enter confirms nothing when no single complete date can be formed', () => {
  const cases = [
    ['J', undefined],
    ['25 ju', undefined],
    ['255/24', undefined],
    ['31122019', { range: { from: '2020-01-01', to: '2020-12-31' } }],
  ];
  for (const [value, overrides] of cases) {
    const { textInput, confirmed } = setup(overrides);
    textInput.type(value);
    textInput.key('Enter');
    assert.deepEqual(confirmed, [], value);
    assert.equal(textInput.value, value);
  }
});

test('AC-19: Enter confirms the reading ArrowDown selected', () => {
  const { textInput, dateInput, confirmed } = setup(R_1900);
  textInput.type('5/5/05');
  textInput.key('ArrowDown');
  textInput.key('Enter');
  assert.deepEqual(confirmed, ['1905-05-05']);
  assert.equal(dateInput.value, '1905-05-05');
  assert.equal(textInput.value, 'May 5, 1905');
});

test('FR-16: a fresh text change puts the selection back on the preferred reading', () => {
  const { textInput, feedback } = setup(R_1900);
  textInput.type('5/5/05');
  textInput.key('ArrowDown');
  assert.equal(feedback.textContent, 'May 5, 1905 (2 of 2)');
  textInput.backspace();
  assert.equal(textInput.value, '5/5/0');
  // `0` is the year 00 → 2000, so the value is complete again on one reading
  // and the marker of the previous selection is gone.
  assert.equal(feedback.textContent, 'May 5, 2000');
  assert.equal(feedback.textContent.includes('of '), false);
});
