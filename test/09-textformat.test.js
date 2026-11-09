// §7 group 9 — commit-time text formats, blur commit/reset and Esc cancel
// (FR-24, FR-25, AC-17, AC-18, AC-26, AC-28).

import test from 'node:test';
import assert from 'node:assert/strict';

import { formatWithPattern } from '../src/format.js';
import { parse } from '../src/parse.js';
import { base } from './helpers/options.js';
import { setup } from './helpers/setup.js';

const DATE = { day: 25, month: 5, year: 2024 };

test('FR-24: every token renders as documented', () => {
  assert.equal(formatWithPattern('d-m-YYYY', DATE), '25-5-2024');
  assert.equal(formatWithPattern('DD-MM-YYYY', DATE), '25-05-2024');
  assert.equal(formatWithPattern('MM-DD-YY', DATE), '05-25-24');
  assert.equal(formatWithPattern('d.m.YYYY', DATE), '25.5.2024');
  assert.equal(formatWithPattern('d MMMM YYYY', DATE), '25 May 2024');
  assert.equal(formatWithPattern('d MMM YYYY', DATE), '25 May 2024');
  assert.equal(formatWithPattern('d-m-yyyy', DATE), '25-5-2024');
});

test('FR-24: a written value always re-parses to the same date', () => {
  for (const pattern of ['d-m-YYYY', 'DD-MM-YYYY', 'MM-DD-YY', 'd.m.YYYY', 'd MMMM YYYY']) {
    const written = formatWithPattern(pattern, DATE);
    assert.equal(parse(written, base()).date, '2024-05-25', `${pattern} → ${written}`);
  }
});

test('FR-24/C28: year-first, Tab and malformed patterns are refused at construction', () => {
  for (const pattern of ['YYYY-MM-DD', 'YY/MM/DD', 'DD-T-YYYY', '25 May', 'DD\tMM\tYYYY']) {
    assert.throws(() => formatWithPattern(pattern, DATE), TypeError, pattern);
  }
});

test('AC-17: a picker selection is written with the pattern, the feedback stays a reading', () => {
  const { textInput, dateInput, feedback } = setup({ textFormat: 'd-m-YYYY' });
  dateInput.selectDate('2024-05-25');
  assert.equal(textInput.value, '25-5-2024');
  assert.equal(feedback.textContent, '25 May 2024');
  assert.equal(dateInput.value, '2024-05-25');
});

test('AC-17: confirming rewrites with the pattern and the result re-parses', () => {
  const { textInput, confirmed } = setup({ textFormat: 'd-m-YYYY' });
  textInput.type('25/5/24');
  textInput.key('Enter');
  assert.deepEqual(confirmed, ['2024-05-25']);
  assert.equal(textInput.value, '25-5-2024');
  assert.equal(parse(textInput.value, base()).date, '2024-05-25');
});

test('AC-17: a year-first pattern throws when the component is created', () => {
  assert.throws(() => setup({ textFormat: 'YYYY-MM-DD' }), TypeError);
});

test('AC-18: blur commits a complete value and rewrites it canonically', () => {
  const { textInput, dateInput, feedback, confirmed } = setup();
  textInput.type('25524');
  textInput.blur();
  assert.deepEqual(confirmed, ['2024-05-25']);
  assert.equal(textInput.value, '25 May 2024');
  assert.equal(dateInput.value, '2024-05-25');
  assert.equal(feedback.textContent, '25 May 2024');
});

test("AC-18: blur proposes today's year exactly like Enter", () => {
  const { textInput, dateInput, feedback, confirmed } = setup();
  textInput.type('25 Sep');
  textInput.blur();
  assert.deepEqual(confirmed, ['2026-09-25']);
  assert.equal(textInput.value, '25 September 2026');
  assert.equal(dateInput.value, '2026-09-25');
  assert.equal(feedback.textContent, '25 September 2026');
});

test('AC-18: blur resets a value that Enter cannot confirm', () => {
  const { textInput, dateInput, feedback } = setup();
  textInput.type('25 May 202');
  textInput.blur();
  assert.equal(textInput.value, '');
  assert.equal(dateInput.value, '');
  assert.equal(feedback.textContent, '');
  assert.equal(feedback.getAttribute('data-status'), 'empty');
});

test('AC-18: blur after Enter does not confirm the same value twice', () => {
  const { textInput, confirmed } = setup();
  textInput.type('25524');
  textInput.key('Enter');
  textInput.blur();
  assert.deepEqual(confirmed, ['2024-05-25']);
});

test('FR-25: the reset writes defaultValue and syncs the date input', () => {
  const { textInput, dateInput } = setup({ defaultValue: '1.1.2000' });
  textInput.type('25 May 202');
  textInput.blur();
  assert.equal(textInput.value, '1.1.2000');
  assert.equal(dateInput.value, '2000-01-01');
});

test('AC-26: Escape restores the last committed value without confirming again', () => {
  const { textInput, dateInput, confirmed } = setup();
  textInput.type('25524');
  textInput.key('Enter');
  textInput.setValue('25 May 202');
  textInput.dispatch('input');
  textInput.key('Escape');
  assert.deepEqual(confirmed, ['2024-05-25']);
  assert.equal(textInput.value, '25 May 2024');
  assert.equal(dateInput.value, '2024-05-25');
});

test('AC-26: Escape with nothing committed restores defaultValue', () => {
  const { textInput, dateInput, confirmed } = setup({ defaultValue: '1.1.2000' });
  textInput.type('25 May 202');
  textInput.key('Escape');
  assert.deepEqual(confirmed, []);
  assert.equal(textInput.value, '1.1.2000');
  assert.equal(dateInput.value, '2000-01-01');
});

test('AC-26: Escape with nothing committed and no default clears the field', () => {
  const { textInput, dateInput, confirmed } = setup();
  textInput.type('25');
  textInput.key('Escape');
  assert.deepEqual(confirmed, []);
  assert.equal(textInput.value, '');
  assert.equal(dateInput.value, '');
});

test('OQ-5: a YY commit writes the pattern when it round-trips', () => {
  const { textInput, dateInput, confirmed } = setup({ textFormat: 'MM-DD-YY' });
  textInput.type('5/5/05');
  textInput.key('Enter');
  assert.deepEqual(confirmed, ['2005-05-05']);
  assert.equal(textInput.value, '05-05-05');
  assert.equal(dateInput.value, '2005-05-05');
});

test('AC-28: a YY commit falls back to display text for another century', () => {
  const range = { from: '1900-01-01', to: 'now' };
  const { textInput, dateInput, confirmed } = setup({ textFormat: 'MM-DD-YY', range });
  textInput.type('5/5/05');
  textInput.key('ArrowDown');
  textInput.blur();
  assert.deepEqual(confirmed, ['1905-05-05']);
  assert.equal(textInput.value, 'May 5, 1905');
  assert.equal(dateInput.value, '1905-05-05');
  assert.equal(parse(textInput.value, base({ range })).date, '1905-05-05');
});

test('FR-25: an empty field is left alone on blur', () => {
  const { textInput, dateInput } = setup({ defaultValue: '1.1.2000' });
  textInput.blur();
  assert.equal(textInput.value, '');
  assert.equal(dateInput.value, '');
});
