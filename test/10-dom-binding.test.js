// §7 group 10 — the page binding: the date input stays in sync, picker
// changes flow back, attributes are managed and destroy() cleans up
// (FR-1, FR-23, FR-26 … FR-29, AC-20, AC-21).

import test from 'node:test';
import assert from 'node:assert/strict';

import { setup } from './helpers/setup.js';

test('FR-27/AC-21: the date input holds a date only while the text resolves to one', () => {
  const { textInput, dateInput } = setup();
  textInput.type('25524');
  assert.equal(dateInput.value, '2024-05-25');

  textInput.setCaretToEnd();
  textInput.backspace();
  assert.equal(textInput.value, '2552');
  assert.equal(dateInput.value, '');

  textInput.type('4');
  assert.equal(dateInput.value, '2024-05-25');
});

test('FR-5/AC-21: typing never rewrites the text field', () => {
  const { textInput } = setup();
  for (const character of '25524') textInput.type(character);
  assert.equal(textInput.value, '25524');
});

test('FR-5/FR-27: a partial value leaves the text as typed and the picker empty', () => {
  const { textInput, dateInput, feedback } = setup();
  textInput.type('25 May 202');
  assert.equal(textInput.value, '25 May 202');
  assert.equal(dateInput.value, '');
  assert.equal(feedback.textContent, '25 May 202…');
});

test('FR-27: a native-picker change fills the text field and confirms', () => {
  const { textInput, dateInput, feedback, confirmed } = setup();
  dateInput.selectDate('2024-05-25');
  assert.equal(textInput.value, '25 May 2024');
  assert.equal(feedback.textContent, '25 May 2024');
  assert.equal(dateInput.value, '2024-05-25');
  assert.deepEqual(confirmed, ['2024-05-25']);
});

test('FR-28: min/max follow the resolved range', () => {
  const { dateInput } = setup();
  assert.equal(dateInput.getAttribute('min'), '1972-02-05');
  assert.equal(dateInput.getAttribute('max'), '2026-11-04');
});

test('FR-28: an absent bound leaves the attribute off', () => {
  const { dateInput } = setup({ range: { from: '1972-02-05' } });
  assert.equal(dateInput.getAttribute('min'), '1972-02-05');
  assert.equal(dateInput.getAttribute('max'), null);
});

test("FR-18/AC-20: 'now' is frozen when the component is created", () => {
  // Day 25 again: `5/11/2026` would keep a middle-endian reading (2026-05-11)
  // that FR-12 lets through, which says nothing about the frozen bound.
  const inside = setup();
  inside.textInput.type('25/10/2026');
  assert.equal(inside.dateInput.value, '2026-10-25');
  assert.equal(inside.dateInput.getAttribute('max'), '2026-11-04');

  const outside = setup();
  outside.textInput.type('25/11/2026');
  assert.equal(outside.dateInput.value, '');
  assert.equal(outside.feedback.getAttribute('data-status'), 'out-of-range');
  assert.equal(outside.dateInput.getAttribute('max'), '2026-11-04');
});

test('FR-1/FR-27: programmatic writes do not loop back', () => {
  const { textInput, dateInput } = setup();
  let textInputEvents = 0;
  let dateInputChanges = 0;
  textInput.addEventListener('input', () => {
    textInputEvents += 1;
  });
  dateInput.addEventListener('change', () => {
    dateInputChanges += 1;
  });

  textInput.type('25524');
  assert.equal(textInputEvents, 1);
  assert.equal(dateInputChanges, 0);

  dateInput.selectDate('2023-03-04');
  assert.equal(dateInputChanges, 1);
  assert.equal(textInput.value, '4 March 2023');
});

test('FR-26: the date input is optional', () => {
  const { textInput, feedback } = setup({ dateInput: undefined });
  textInput.type('25524');
  assert.equal(feedback.textContent, '25 May 2024');
});

test('FR-23: the feedback is a polite live region and the field is described', () => {
  const { textInput, feedback } = setup();
  assert.equal(feedback.getAttribute('role'), 'status');
  assert.equal(feedback.getAttribute('aria-live'), 'polite');
  const describedBy = textInput.getAttribute('aria-describedby');
  assert.ok(describedBy);
  assert.equal(describedBy, feedback.getAttribute('id'));
});

test('FR-22: the feedback slot may be a renderer function', () => {
  const seen = [];
  const { textInput } = setup({ feedback: (result) => seen.push(result) });
  textInput.type('25524');
  assert.equal(seen.at(-1).status, 'complete');
  assert.equal(seen.at(-1).text, '25 May 2024');
});

test('FR-29: destroy() removes the listeners it added', () => {
  const { textInput, parser, feedback } = setup();
  textInput.type('25524');
  parser.destroy();
  assert.equal(textInput.listenerCount('input'), 0);
  assert.equal(textInput.listenerCount('keydown'), 0);

  feedback.textContent = 'untouched';
  textInput.type('2');
  assert.equal(feedback.textContent, 'untouched');
});

test('FR-29: destroy() restores the attributes it added', () => {
  const { parser, textInput, dateInput } = setup();
  parser.destroy();
  assert.equal(textInput.getAttribute('aria-describedby'), null);
  assert.equal(dateInput.getAttribute('min'), null);
  assert.equal(dateInput.getAttribute('max'), null);
});

test('FR-28: the host can open the native picker on request', () => {
  const { parser, dateInput } = setup();
  parser.openPicker();
  assert.equal(dateInput.showPickerCalls, 1);
});

test('FR-22: getResult() returns the current structured result', () => {
  const { textInput, parser } = setup();
  textInput.type('25524');
  assert.equal(parser.getResult().date, '2024-05-25');
});
