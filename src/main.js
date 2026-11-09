// Demo entry point. Vite serves this file (and everything it imports) as native ES
// modules, so what runs in the browser is exactly what is in the repository.
//
// The demo renders the structured result, which is the point of the component: the
// feedback line carries the reading and the status, and everything else — parts,
// spans, the reading list, why nothing survived — is plain data.

import { createIncrementalDateParser } from './index.js';

const RANGE = { from: '1972-02-05', to: 'now' };

const textInput = document.querySelector('#date-text');
const dateInput = document.querySelector('#date-native');
const feedback = document.querySelector('#date-feedback');
const highlight = document.querySelector('#date-highlight');
const openPicker = document.querySelector('#open-picker');
const resultSlot = document.querySelector('#date-result');

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

if (textInput && dateInput && feedback && highlight && resultSlot) {
  const parser = createIncrementalDateParser({
    textInput,
    dateInput,
    feedback,
    range: RANGE,
    onReadingChange: (result) => {
      highlight.innerHTML = result.highlighted;
      resultSlot.textContent = JSON.stringify(summarise(result), null, 2);
    },
    onConfirm: (iso) => {
      resultSlot.dataset.confirmed = iso;
    },
  });

  if (openPicker) openPicker.addEventListener('click', () => parser.openPicker());

  document.querySelector('#demo').dataset.ready = 'true';
}
