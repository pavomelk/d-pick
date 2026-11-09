// The DOM binding (FR-1, FR-5, FR-23 … FR-29).
//
// All parsing happens in `parse`; this module only moves values between the
// two fields, the feedback slot and the callbacks. Its own writes are
// programmatic and never re-enter its handlers.

import { isValidDate, isoOf, parseIsoDate } from './dates.js';
import { compilePattern, MONTH_NAMES, renderPattern, selectReading } from './format.js';
import { normaliseNow, parse, resolveRange } from './parse.js';

const ALLOWED_INSERTION = /^[0-9A-Za-z.\-/, \n\r\f\v]*$/;
const DISALLOWED_CHARACTERS = /[^0-9A-Za-z.\-/, \n\r\f\v]/g;
const DEFAULT_MAX_READINGS = 8;

let instanceCount = 0;

export function createIncrementalDateParser(options = {}) {
  const { textInput } = options;
  if (!textInput) throw new TypeError('textInput is required');

  const dateInput = options.dateInput || null;
  const feedbackSlot = options.feedback || null;
  const feedbackElement = feedbackSlot && typeof feedbackSlot !== 'function' ? feedbackSlot : null;
  const feedbackRenderer = typeof feedbackSlot === 'function' ? feedbackSlot : null;

  // The clock is read once: `'now'` and today's year stay fixed for this
  // component's lifetime (FR-18, C8).
  const frozenNow = normaliseNow(options.now);
  const range = resolveRange(options.range, frozenNow);
  const pattern = options.textFormat == null ? null : compilePattern(options.textFormat);
  const defaultValue = options.defaultValue == null ? '' : String(options.defaultValue);
  const requestedCap = Number(options.maxReadings);
  const maxReadings =
    Number.isFinite(requestedCap) && requestedCap > 0
      ? Math.floor(requestedCap)
      : DEFAULT_MAX_READINGS;
  const parseOptions = { range, now: frozenNow, maxReadings };

  const managed = [];
  let selectedIndex = 0;
  let result = parse(textInput.value, parseOptions);
  let current = selectReading(result, 0);
  let lastCommittedText = null;
  let destroyed = false;

  function manageAttribute(element, name, value) {
    if (!element) return;
    managed.push({ element, name, previous: element.getAttribute(name) });
    element.setAttribute(name, value);
  }

  function manageAttributes() {
    if (dateInput) {
      if (range.from) manageAttribute(dateInput, 'min', range.from);
      if (range.to) manageAttribute(dateInput, 'max', range.to);
    }

    if (!feedbackElement) return;

    manageAttribute(feedbackElement, 'role', 'status');
    manageAttribute(feedbackElement, 'aria-live', 'polite');

    if (!feedbackElement.getAttribute('id')) {
      instanceCount += 1;
      manageAttribute(feedbackElement, 'id', `incremental-date-feedback-${instanceCount}`);
    }

    const describedBy = feedbackElement.getAttribute('id');
    const existing = textInput.getAttribute('aria-describedby');
    manageAttribute(
      textInput,
      'aria-describedby',
      existing ? `${existing} ${describedBy}` : describedBy,
    );
  }

  function render() {
    const presented = selectReading(result, selectedIndex);
    current = presented;

    if (feedbackRenderer) feedbackRenderer(presented);
    else if (feedbackElement) {
      feedbackElement.textContent = presented.text;
      feedbackElement.setAttribute('data-status', presented.status);
    }

    if (dateInput) {
      // The date input holds a date only while the text resolves to exactly
      // one (FR-27, AC-21); anything else empties it.
      const next = presented.status === 'complete' && presented.date ? presented.date : '';
      if (dateInput.value !== next) dateInput.value = next;
    }

    if (typeof options.onReadingChange === 'function') options.onReadingChange(presented);
    return presented;
  }

  function syncFromText() {
    selectedIndex = 0;
    result = parse(textInput.value, parseOptions);
    render();
  }

  function writeText(text) {
    textInput.value = text;
    if (typeof textInput.setSelectionRange === 'function') {
      textInput.setSelectionRange(text.length, text.length);
    }
  }

  function insertSanitised(text) {
    const value = textInput.value || '';
    const start = textInput.selectionStart == null ? value.length : textInput.selectionStart;
    const end = textInput.selectionEnd == null ? start : textInput.selectionEnd;
    textInput.value = value.slice(0, start) + text + value.slice(end);
    const caret = start + text.length;
    if (typeof textInput.setSelectionRange === 'function') textInput.setSelectionRange(caret, caret);
    syncFromText();
  }

  function confirmableDate() {
    if (!current || current.readings.length === 0) return null;

    // A full date is confirmed as presented, whichever reading is selected.
    if (current.status === 'complete' || current.status === 'ambiguous') return current.date;
    if (current.status !== 'partial') return null;

    const reading = current.readings[0];
    if (reading.day === null || reading.month === null) return null;
    // A year the user started is never invented (AC-16).
    if (reading.yearPrefix) return null;

    const agrees = current.readings.every(
      (other) =>
        other.day === reading.day && other.month === reading.month && !other.yearPrefix,
    );
    if (!agrees) return null;

    const year = Number(frozenNow.slice(0, 4));
    if (!isValidDate(year, reading.month, reading.day)) return null;
    const iso = isoOf(year, reading.month, reading.day);
    if (range.from && iso < range.from) return null;
    if (range.to && iso > range.to) return null;
    return iso;
  }

  function displayText(date, endianness) {
    const day = String(date.day);
    const month = MONTH_NAMES[date.month - 1];
    const year = String(date.year);
    return endianness === 'middle' ? `${month} ${day}, ${year}` : `${day} ${month} ${year}`;
  }

  function commitText(date, iso, endianness) {
    if (pattern) {
      const candidate = renderPattern(pattern, date);
      const reparsed = parse(candidate, parseOptions);
      // A `YY` pattern cannot carry a non-preferred century (OQ-5 A): write
      // display text instead so the field still re-parses to the same date.
      if (reparsed.status === 'complete' && reparsed.date === iso) return candidate;
    }
    return displayText(date, endianness);
  }

  function applyDate(iso, endianness = null) {
    const date = parseIsoDate(iso);
    if (!date) return false;

    writeText(commitText(date, iso, endianness));
    lastCommittedText = textInput.value;

    selectedIndex = 0;
    result = parse(textInput.value, parseOptions);
    render();

    if (typeof options.onConfirm === 'function') options.onConfirm(iso);
    return true;
  }

  function onBeforeInput(event) {
    if (destroyed) return;
    const data = event.data;
    if (data == null || data === '') return;
    if (ALLOWED_INSERTION.test(data)) return;

    event.preventDefault();
    const cleaned = data.replace(DISALLOWED_CHARACTERS, '');
    if (cleaned) insertSanitised(cleaned);
  }

  function onInput() {
    if (destroyed) return;
    syncFromText();
  }

  function onKeyDown(event) {
    if (destroyed) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      writeText(lastCommittedText == null ? defaultValue : lastCommittedText);
      selectedIndex = 0;
      result = parse(textInput.value, parseOptions);
      render();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const count = current.readings.length;
      if (!current.navigable || count < 2) return;
      selectedIndex =
        event.key === 'ArrowDown'
          ? (selectedIndex + 1) % count
          : (selectedIndex - 1 + count) % count;
      event.preventDefault();
      render();
      return;
    }

    if (event.key !== 'Enter') return;

    const iso = confirmableDate();
    if (!iso) return;
    event.preventDefault();
    applyDate(iso, current.endianness);
  }

  function onBlur() {
    if (destroyed) return;
    if (current.status === 'empty') return;
    if (textInput.value === lastCommittedText) return;

    // Blur commits exactly what Enter would confirm (FR-25, C27).
    const iso = confirmableDate();
    if (iso) {
      applyDate(iso, current.endianness);
      return;
    }

    // Anything Enter cannot confirm resets (FR-25, C11).
    writeText(defaultValue);
    selectedIndex = 0;
    result = parse(textInput.value, parseOptions);
    render();
  }

  function onDateInputChange() {
    if (destroyed || !dateInput) return;
    const iso = dateInput.value;
    if (!iso) return;
    applyDate(iso);
  }

  manageAttributes();

  textInput.addEventListener('beforeinput', onBeforeInput);
  textInput.addEventListener('input', onInput);
  textInput.addEventListener('keydown', onKeyDown);
  textInput.addEventListener('blur', onBlur);
  if (dateInput) dateInput.addEventListener('change', onDateInputChange);

  render();

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;

      textInput.removeEventListener('beforeinput', onBeforeInput);
      textInput.removeEventListener('input', onInput);
      textInput.removeEventListener('keydown', onKeyDown);
      textInput.removeEventListener('blur', onBlur);
      if (dateInput) dateInput.removeEventListener('change', onDateInputChange);

      for (const { element, name, previous } of managed.reverse()) {
        if (previous === null) element.removeAttribute(name);
        else element.setAttribute(name, previous);
      }
      managed.length = 0;
    },

    openPicker() {
      if (!dateInput) return;
      if (typeof dateInput.showPicker === 'function') dateInput.showPicker();
      else if (typeof dateInput.focus === 'function') dateInput.focus();
    },

    getResult() {
      return current;
    },
  };
}
