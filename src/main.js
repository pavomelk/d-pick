// Demo entry point. Vite serves this file (and everything it imports) as native ES
// modules, so what runs in the browser is exactly what is in the repository.
//
// The demo renders the structured result, which is the point of the component: the
// feedback line carries the reading and the status, and everything else — parts,
// spans, the reading list, why nothing survived — is plain data.

import { createIncrementalDateParser, resolveRange } from './index.js';
import { formatRangeInput, parseRangeInput } from './demo-range.js';

const INITIAL_RANGE = { from: '1672-02-05', to: 'now' };

const textInput = document.querySelector('#date-text');
const dateInput = document.querySelector('#date-native');
const feedback = document.querySelector('#date-feedback');
const highlight = document.querySelector('#date-highlight');
const openPicker = document.querySelector('#open-picker');
const rangeInput = document.querySelector('#date-range');
const rangeStatus = document.querySelector('#range-status');
const resultSlot = document.querySelector('#date-result');
const demo = document.querySelector('#demo');

function summarise(result) {
  return {
    value: result.value,
    status: result.status,
    text: result.text,
    date: result.date,
    endianness: result.endianness,
    parts: result.parts,
    spans: result.spans,
    highlighted: result.highlighted,
    index: result.index,
    navigable: result.navigable,
    readings: result.readings.map((reading) => ({
      endianness: reading.endianness,
      day: reading.day,
      month: reading.month,
      year: reading.year,
      iso: reading.iso,
      yearPrefix: reading.yearPrefix,
    })),
  };
}

function createParser(range) {
  return createIncrementalDateParser({
    textInput,
    dateInput,
    feedback,
    range,
    onReadingChange: (result) => {
      highlight.innerHTML = result.highlighted;
      resultSlot.textContent = JSON.stringify(summarise(result), null, 2);
    },
    onConfirm: (iso) => {
      resultSlot.dataset.confirmed = iso;
    },
  });
}

let parser = null;
let currentRange = INITIAL_RANGE;

function applyRange(range) {
  if (parser) parser.destroy();
  parser = createParser(range);
  currentRange = range;
  if (demo) demo.dataset.ready = 'true';
}

if (textInput && dateInput && feedback && highlight && resultSlot) {
  applyRange(INITIAL_RANGE);

  if (rangeInput) {
    rangeInput.value = formatRangeInput(INITIAL_RANGE);
    rangeInput.addEventListener('blur', () => {
      let range;
      try {
        range = parseRangeInput(rangeInput.value);
        resolveRange(range);
      } catch (error) {
        rangeInput.value = formatRangeInput(currentRange);
        if (rangeStatus) {
          rangeStatus.dataset.status = 'error';
          rangeStatus.textContent = `Range not applied: ${
            error instanceof Error ? error.message : String(error)
          }`;
        }
        return;
      }

      applyRange(range);
      if (rangeStatus) {
        delete rangeStatus.dataset.status;
        rangeStatus.textContent = `Range applied: ${formatRangeInput(range) || 'unbounded'}`;
      }
    });
  }

  if (openPicker) openPicker.addEventListener('click', () => parser.openPicker());
}
