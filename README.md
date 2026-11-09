# Incremental Date Parser

A plain JavaScript component that incrementally reads a date from a text input and explains how it currently understands the value.

It is designed to complement, not replace, an existing `<input type="date">`. The native picker remains available while the text field gives immediate, range-aware feedback as the user types.

## Features

- Incremental parsing on every text change
- Little-endian (`25 May 2024`) and middle-endian (`May 25, 2024`) dates
- No year-first/big-endian interpretation
- Two-digit years with range-aware century resolution
- Month names, abbreviations, and typed prefixes (`N` → November, `J` → June/July/January)
- Configurable date range, including `'now'` frozen when the component is created
- Keyboard navigation through ambiguous readings with `ArrowDown`/`ArrowUp`
- `Enter` and blur commits; `Esc` cancels the current edit
- Optional `textFormat` for writing values back to the text field
- Syncs with an optional native date input
- Safe highlighted suggestion HTML that emphasizes the typed parts
- No runtime dependencies

## Quick Start

Requires Node `^20.19.0 || >=22.12.0` for the Vite development server and build.

```bash
npm install
npm run dev
```

Open the URL printed by Vite to use the demo.

## Usage

```html
<input id="date-text" type="text" />
<input id="date-native" type="date" />
<p id="date-feedback"></p>
```

```js
import { createIncrementalDateParser } from './src/index.js';

const parser = createIncrementalDateParser({
  textInput: document.querySelector('#date-text'),
  dateInput: document.querySelector('#date-native'),
  feedback: document.querySelector('#date-feedback'),
  range: { from: '1972-02-05', to: 'now' },
  onReadingChange: (result) => {
    console.log(result.text, result.status, result.highlighted);
  },
  onConfirm: (isoDate) => {
    console.log('Confirmed:', isoDate);
  },
});
```

The parser can also be used without the DOM:

```js
import { parse } from './src/index.js';

const result = parse('25524', {
  range: { from: '1972-02-05', to: 'now' },
  now: '2026-11-04',
});

console.log(result.status); // "complete"
console.log(result.date);   // "2024-05-25"
console.log(result.text);   // "25 May 2024"
```

## API

`createIncrementalDateParser(options)` accepts:

| Option | Description |
| --- | --- |
| `textInput` | Required text input element |
| `dateInput` | Optional native date input element |
| `feedback` | Optional feedback element, or a `(result) => void` renderer |
| `range` | `{ from, to }`; each bound may be omitted, `'now'`, or `YYYY-MM-DD` |
| `textFormat` | Optional commit-time pattern such as `'d-m-YYYY'` or `'MM-DD-YY'` |
| `defaultValue` | Value restored on blur reset or `Esc` with no commit |
| `maxReadings` | Maximum navigable readings; defaults to `8` |
| `onReadingChange` | Called with the structured result whenever the reading changes |
| `onConfirm` | Called with a confirmed `YYYY-MM-DD` date |

The returned parser exposes:

- `parser.getResult()` — the current structured result
- `parser.openPicker()` — opens the native date picker when available
- `parser.destroy()` — removes listeners and restores managed attributes

The structured result includes `status`, `date`, `endianness`, `parts`, `spans`, `index`, `navigable`, `readings`, `text`, and `highlighted`.

`highlighted` is an HTML string for visual suggestions. For example, with a range that resolves the year to 1952:

```html
<em>2</em>&nbsp;<em>4</em>(April)&nbsp;19<em>52</em>
```

## Demo

`index.html` is a Vite-served demo that imports the source modules directly. It renders the feedback text, the highlighted suggestion, and the full structured result.

```bash
npm run dev
```

## Testing

Tests use Node's built-in test runner.

```bash
npm test
```

Build the demo with:

```bash
npm run build
```

## Project Layout

```text
src/
  component.js   DOM binding and keyboard behavior
  parse.js       Pure parser entry point
  scan.js        Input segmentation
  shapes.js      Reading construction
  format.js      Display text, highlighting, and reading selection
  dates.js       Date helpers
test/            Node test files, grouped by requirement area
index.html       Demo page
requirements.md  Normative behavior and acceptance scenarios
```

## Documentation

- [`requirements.md`](requirements.md) — functional requirements, acceptance scenarios, and decisions
- [`problem_statement.md`](problem_statement.md) — original problem statement
- [`AGENTS.md`](AGENTS.md) — repository working conventions
