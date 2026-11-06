// Component harness for the binding tests: fake DOM elements plus the
// callbacks the tests observe.

import { createIncrementalDateParser } from '../../src/component.js';
import { createTextInput, createDateInput, createFeedback } from './fake-dom.js';
import { base } from './options.js';

export function setup(overrides = {}) {
  const textInput = createTextInput();
  const dateInput = createDateInput();
  const feedback = createFeedback();
  const confirmed = [];
  const readingChanges = [];

  const parser = createIncrementalDateParser({
    textInput,
    dateInput,
    feedback,
    onConfirm: (iso) => confirmed.push(iso),
    onReadingChange: (result) => readingChanges.push(result),
    ...base(),
    ...overrides,
  });

  return { textInput, dateInput, feedback, parser, confirmed, readingChanges };
}
