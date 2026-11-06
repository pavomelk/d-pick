// §7 group 6 — character blocking, paste sanitising and letter handling
// (FR-2, AC-14), exercised through the DOM layer.

import test from 'node:test';
import assert from 'node:assert/strict';

import { setup } from './helpers/setup.js';

test('FR-2: typing a disallowed character leaves the value untouched', () => {
  const { textInput } = setup();
  textInput.type('2');
  textInput.type('#');
  assert.equal(textInput.value, '2');
});

test('FR-2: disallowed characters are stripped from pasted text, the rest is kept', () => {
  const { textInput } = setup();
  textInput.paste('2#5');
  assert.equal(textInput.value, '25');
});

test('FR-2: letters are allowed, they feed the month matcher', () => {
  const { textInput, feedback } = setup();
  textInput.type('25 sep');
  assert.equal(textInput.value, '25 sep');
  assert.equal(feedback.textContent, '25 September …');
});

test('FR-2: a blocked character does not move the caret', () => {
  const { textInput } = setup();
  textInput.setValue('25524');
  textInput.setSelectionRange(2, 2);
  textInput.type('#');
  assert.equal(textInput.value, '25524');
  assert.equal(textInput.selectionStart, 2);
  assert.equal(textInput.selectionEnd, 2);
});

test('FR-2: deleting is never blocked', () => {
  const { textInput, feedback } = setup();
  textInput.type('25524');
  textInput.backspace();
  assert.equal(textInput.value, '2552');
  assert.equal(feedback.textContent, '25 May 2002');
});

test('FR-2: separators and whitespace are accepted', () => {
  const { textInput } = setup();
  textInput.type('25-5-2024');
  assert.equal(textInput.value, '25-5-2024');
  textInput.setValue('');
  textInput.type('25 / 5 / 2024');
  assert.equal(textInput.value, '25 / 5 / 2024');
});

test('AC-14: unmatched letters stay in the field but make the value invalid', () => {
  const { textInput, feedback } = setup();
  textInput.type('xyz');
  assert.equal(textInput.value, 'xyz');
  assert.equal(feedback.textContent, 'Not enough information');
  assert.equal(feedback.getAttribute('data-status'), 'invalid');
});
