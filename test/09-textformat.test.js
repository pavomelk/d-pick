// §7 group 9 — commit-time text formats and the blur reset
// (FR-24, FR-25, AC-17, AC-18).

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

test('FR-24: year-first and malformed patterns are refused at construction', () => {
  for (const pattern of ['YYYY-MM-DD', 'YY/MM/DD', 'DD-T-YYYY', '25 May']) {
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

test('AC-18: blur clears a value that is not unambiguously interpreted', () => {
  const { textInput, dateInput, feedback } = setup();
  textInput.type('25 Sep');
  textInput.blur();
  assert.equal(textInput.value, '');
  assert.equal(dateInput.value, '');
  assert.equal(feedback.textContent, '');
  assert.equal(feedback.getAttribute('data-status'), 'empty');
});

test('AC-18: blur leaves a complete value in place', () => {
  const { textInput, dateInput } = setup();
  textInput.type('25524');
  textInput.blur();
  assert.equal(textInput.value, '25524');
  assert.equal(dateInput.value, '2024-05-25');
});

test('FR-25: the reset writes defaultValue and syncs the date input', () => {
  const { textInput, dateInput } = setup({ defaultValue: '1.1.2000' });
  textInput.type('25 Sep');
  textInput.blur();
  assert.equal(textInput.value, '1.1.2000');
  assert.equal(dateInput.value, '2000-01-01');
});

test('FR-25: an empty field is left alone on blur', () => {
  const { textInput, dateInput } = setup({ defaultValue: '1.1.2000' });
  textInput.blur();
  assert.equal(textInput.value, '');
  assert.equal(dateInput.value, '');
});
