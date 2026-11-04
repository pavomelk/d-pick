# Requirements — Incremental Segmented Date Parser

Status: **draft v0.1** (initial draft, derived only from `problem_statement.md`; not yet reviewed)
Source: [`problem_statement.md`](problem_statement.md)

Priorities: **MUST** = needed for the first working version · **SHOULD** = expected, unless clearly too costly · **MAY** = optional.

## 1. Purpose

The component helps a person type a date into a plain `<input type="text">`.
On every text change it re-reads the whole value, eliminates readings that the entered characters and the
configured date range make impossible, and immediately shows how the input is currently understood
(using month names). The text field sits next to a normal `<input type="date">`, whose native calendar
picker stays usable for the same date.

The component never guesses silently: when the input can honestly be read in several ways it says so.

## 2. Goals and non-goals

Goals

- G1 Digit-only entry is enough: `2`,`5`,`5`,`2`,`4` can resolve to `25 May 2024`.
- G2 Ambiguity is resolved by elimination, not by a fixed format: the same prefix can be read as
  month-first or day-first and the interpretation may change while the user types.
- G3 The current reading is always visible, so the user sees early when the parser went down the wrong path.
- G4 Only dates inside an application-defined range can ever be produced.

Non-goals for v1

- Time of day, time zones, durations.
- Locales other than English (`May`, not `mai`/`Mai`).
- Free-form natural language ("tomorrow", "next fri").
- Replacing or restyling the native date picker.
- Rewriting/formating the text field while the user types (the typed value stays exactly as typed).
- Mobile-specific keypads or native date-keyboard hints.

## 3. Terms

- **Part** — one of day, month, year.
- **Segment** — a contiguous slice of the input that is assigned to one part.
- **Segmentation** — a split of the input into segments plus the endianness that orders them.
- **Candidate** — one complete reading: a segmentation with concrete values (including the century of a
  two-digit year) that is a real, in-range calendar date.
- **Partial candidate** — a reading that is still incomplete (a part missing or a segment cut off) but can
  still become a candidate by typing more characters.
- **Reading (interpretation)** — the candidate or partial candidate the component currently presents.
- **Reparse** — building all readings from scratch from the current text value.

## 4. Functional requirements

### 4.1 Input and parsing

- **FR-1 (MUST)** Parse incrementally: on every text change of the text input (`input` event, including
  typing, deleting, paste, drag-and-drop, IME commit, autofill) the component re-evaluates the whole
  current value. The result MUST depend only on the current value, the configured range and "now" — no
  hidden state from previous keystrokes. Re-entering the same string therefore gives the same result.
- **FR-2 (MUST)** Accept decimal digits `0-9` and ASCII letters, case-insensitively. A run of letters is
  matched against English month names, both full (`september`) and abbreviated (`sep`, `sept`) and as a
  prefix while the user is still typing (`septem`). A run that matches no month name is invalid input.
- **FR-3 (MUST)** Ignore separator characters when interpreting the input and use them only as optional
  segment boundaries: space, `-`, `/`, `.`, `,`. (See OQ-1.) Any other character makes the whole input
  invalid (FR-12, status `invalid`); the value itself is never modified.
- **FR-4 (MUST)** When the input is digits only, consider every split of the digit string into up to three
  segments, subject to the length rules below, and keep those splits whose values are valid for their
  part:
  - day: 1–2 digits, value 1–31;
  - month: 1–2 digits, value 1–12 (or a letter run per FR-2);
  - year: 2 or 4 digits (see FR-6, FR-7).
  A 1-digit segment is only possible when a boundary is fixed by the next segment or by a letter run;
  while typing, all boundary positions are considered.
- **FR-5 (MUST)** An explicitly typed month name fixes the month segment; the remaining digits fill the
  day and year segments in the order given by the endianness (FR-8).
- **FR-6 (MUST)** Accept two-digit years and derive the century (FR-9), and accept four-digit years.
  Years of 1 or 3 digits are not year segments: a reading that would need one is impossible. This is the
  rule behind the "the following `5` cannot fall into the year range" situation in the source example
  (see AC-4 and OQ-2).

### 4.2 Elimination and preference

- **FR-7 (MUST)** Eliminate a partial candidate at every step when no completion of it is an in-range
  calendar date. A partial candidate survives only while at least one in-range completion exists, so that
  a reading the user can still finish is never hidden.
- **FR-8 (MUST)** Support little-endian (day-month-year) and middle-endian (month-day-year) only, and
  prefer little-endian: whenever at least one little-endian reading survives after FR-7, the component
  MUST present a little-endian reading and MUST NOT present a middle-endian one. Middle-endian is used
  only when every surviving little-endian reading has been eliminated.
- **FR-9 (MUST)** Derive the century of a two-digit year from the allowed range: let the year take values
  `yy + 100*c` and keep the centuries `c` whose resulting date is inside the range. If several centuries
  remain, prefer the one closest to today (OQ-3). If none remains, eliminate the candidate.
- **FR-10 (MUST)** Instead of a single reading, present "not enough information" when the surviving
  readings cannot be ordered by FR-8 (for example a single digit, which can start a day or a month), i.e.
  when no reading is strictly preferred. FR-8's endianness preference alone decides between readings that
  differ only in endianness.

### 4.3 Date range

- **FR-11 (MUST)** The application configures an allowed range `{ from, to }`. Each bound may be
  `undefined` (unbounded), `'now'` (today's calendar date, re-evaluated on every parse), or an ISO date
  string `YYYY-MM-DD`. Bounds are inclusive. If both are given and `from > to`, construction fails with a
  `TypeError` — the application is expected to prevent this in its own UI.
- **FR-12 (SHOULD)** Range violations are explainable: the feedback may state why a reading was dropped
  ("cannot be 05-02 because no year fits the range"). The exact wording is free (OQ-7), but the
  presentation must distinguish "not enough information", "ambiguous", "invalid" and "outside range".

### 4.4 Feedback

- **FR-13 (MUST)** Report the current reading on every text change, in a way that shows which part is
  which and how far the entry got, using month names. Ordering in the text follows the interpretation:
  - middle-endian, complete → `May 25, 2024`
  - little-endian, complete → `25 May 2024`
  - a missing or unfinished part is shown as an ellipsis at its position: digits `525` → `May 25…`,
    `5252` → `May 25, 202…` (partial year shown with the century digits that are already implied).
  - no usable reading → `Not enough information`.
  The precise ellipsis/typography is an implementation detail, but the month name, the ordering and the
  visible level of completeness are required (see AC-1 … AC-10).
- **FR-14 (MUST)** Report a machine-readable status next to the text: `empty`, `undetermined`
  (not enough information), `partial` (a single preferred reading, still incomplete), `complete` (exactly
  one in-range date), `ambiguous` (several in-range dates, all equally preferred, presented with the
  preferred one first per FR-8), `invalid` (characters or values that can never form a date),
  `out-of-range` (a well-formed date exists but no reading is in range).
- **FR-15 (SHOULD)** Expose the structured result to the host application, not only the text: the chosen
  date (`YYYY-MM-DD` or `null`), endianness, per-part values and digit spans, status, and the list of
  competing readings. The demo page can render it.
- **FR-16 (MUST)** Accessibility: the feedback element must be announced politely (`role="status"` /
  `aria-live="polite"`), and the component must be fully usable with the keyboard alone. Colour is never
  the only indicator of a problem.

### 4.5 Integration with `<input type="date">`

- **FR-17 (MUST)** The component attaches to an existing `<input type="text">` for typing and to an
  optional existing `<input type="date">` whose native picker stays available. It MUST NOT replace,
  hide or rebuild the date input, and MUST NOT require its own picker.
- **FR-18 (MUST)** Keep both fields consistent: when the parse reaches `complete`, the date input's value
  is set to that date; when the date input changes (native picker), the component presents that date as
  the current reading (and per OQ-4 may also fill the text input). Programmatic updates must not loop.
- **FR-19 (SHOULD)** The date input's `min`/`max` attributes are kept in sync with the configured range
  (omitted when a bound is absent or `'now'`), and the component offers the host a way to open the native
  picker on request.

### 4.6 API and packaging

- **FR-20 (MUST)** The public entry point is a factory:

  ```js
  const parser = createIncrementalDateParser({
    textInput,        // required HTMLInputElement (type="text")
    dateInput,        // optional HTMLInputElement (type="date")
    feedback,         // optional element, or (reading) => void renderer
    range: { from: '1972-02-05', to: 'now' }, // bounds optional
    onReadingChange,  // optional (reading) => void
  });
  parser.destroy();                 // removes listeners
  ```

  (Draft signature; the exact option names are settled in the design step.)

## 5. Behaviour to reproduce (acceptance scenarios)

Base scenario: range `from = 1972-02-05`, `to = 'now'`, and "today" is any day in 2024 or later.

**AC-1 … AC-5 — middle-endian digits (source example 1)**

| step | value  | status          | reading          | note                                                              |
| ---- | ------ | --------------- | ---------------- | ----------------------------------------------------------------- |
| 1    | `5`    | `undetermined`  | Not enough information | one digit can start a day or a month                     |
| 2    | `52`   | `partial`       | `May …`          | 52 cannot be a day, so the first digit must be the month          |
| 3    | `525`  | `partial`       | `May 25…`        | digits split `5 \| 25`, year still missing                        |
| 4    | `5252` | `partial`       | `May 25, 202…`   | year segment starts with `2`, century 20 implied                  |
| 5    | `52524`| `complete`      | `May 25, 2024`   | exactly one in-range date; the date input is filled               |

**AC-6 … AC-10 — little-endian winning (source example 2)**

| step | value   | status         | reading        | note                                                                    |
| ---- | ------- | -------------- | -------------- | ----------------------------------------------------------------------- |
| 6    | `2`     | `undetermined` | Not enough information |                                                              |
| 7    | `25`    | `undetermined` | Not enough information | still readable as day 25 or as month 2 + day 5              |
| 8    | `255`   | `partial`      | `25 May …`     | month-first reading needs a 1-digit year → eliminated; little-endian survives |
| 9    | `2552`  | `partial`      | `25 May 20…`   |                                                                          |
| 10   | `25524` | `complete`     | `25 May 2024`  | the date input is filled                                                 |

**AC-11 — range elimination**: with range `from = 2020-01-01`, `to = 2020-12-31`, value `31122019`
yields status `out-of-range` (a complete date exists, but 2019 is outside), and `311220` → `31 December
20…` resolves to 2020 only.

**AC-12 — month names**: value `25 sep` → `partial`, `25 September …`; `25 september 2024` → `complete`,
`25 September 2024`.

## 6. Non-functional requirements

- **NFR-1** No runtime dependency; plain ES modules, no transpiling, no bundling required to use the
  component. Vite is development tooling only.
- **NFR-2** Core logic is pure and DOM-free (`parse(value, { range, now })` → readings), so it can be
  unit tested in Node without a browser; a thin binding layer handles the DOM.
- **NFR-3** Deterministic and fast enough to run on every keystroke: parsing is a small combinatorial
  search over a handful of splits, well under a frame for inputs of normal length (cap input length at,
  say, 64 characters).
- **NFR-4** Test-first: every acceptance scenario above and every rule in §4 is covered by a failing test
  before it is implemented (`node --test`, no test framework dependency).
- **NFR-5** The demo page (`index.html`, served by Vite) imports the source modules directly, "as is";
  no minified or transpiled artefacts are used in it.

## 7. Testing plan (tests written before code)

1. Segmentation of digit strings: every split for `5`, `52`, `525`, `5252`, `52524`, `2`, `25`, `255`,
   `2552`, `25524`, long and invalid digit strings.
2. Endianness preference (FR-8) and "not enough information" (FR-10).
3. Range elimination including partial candidates (FR-7), bound modes `undefined`/`'now'`/ISO, invalid
   ranges (FR-11).
4. Two-digit century derivation (FR-9), including a range that spans two centuries.
5. Month names, abbreviations and prefixes (FR-2, FR-5) and separator handling (FR-3).
6. Feedback text and status for each state (FR-13, FR-14), including the ellipsis positions.
7. Page binding: `input` events, paste, deletion, completion → date input value, picker → reading,
   `destroy()` removes listeners (FR-1, FR-18).

## 8. Out of scope for this version

- Year-first (`YYYY-MM-DD`) typing, day-month `MMMM` locales, era/BC, week numbers.
- Automatic correction or reformatting of the typed value.
- Persistence, form serialisation helpers, framework wrappers.

## 9. Traceability to the problem statement

| Statement sentence                                                        | Requirements         |
| ------------------------------------------------------------------------- | -------------------- |
| incrementally parse … by analyzing consecutively entered digit or letter  | FR-1, FR-2, FR-4     |
| eliminate possibilities of misinterpreting input                          | FR-7, FR-8, FR-10    |
| middle-endian and little-endian only                                      | FR-8                 |
| two-digit year, derive century                                            | FR-6, FR-9           |
| application-specified date range rules out impossible dates               | FR-11, FR-7          |
| `<input type="text">` next to `<input type="date">` with its picker        | FR-17, FR-18, FR-19  |
| visual feedback on every text change                                      | FR-13, FR-14         |
| month names in the interpretation                                         | FR-2, FR-13          |
| prefer little-endian over middle-endian                                   | FR-8                 |
| bounds may be undefined or `'now'`, upper ≥ lower                         | FR-11                |
| the two worked examples                                                   | AC-1 … AC-10         |

## 10. Open questions (proposed defaults must be confirmed)

| id   | question | proposed default | blocked work |
| ---- | -------- | ---------------- | ------------ |
| OQ-1 | May the user type separators (`25/5/2024`, `25.5.24`, `25 May 2024`)? Do separators pin segment boundaries? | Accept the four separators listed in FR-3 and ignore them (no boundary pinning) | FR-3 |
| OQ-2 | Source example 2 explains the dropped month-first reading by the year range, but `5` would give 2005, which is in range. Is the real rule "a year segment has 2 or 4 digits"? | Yes, year length is the rule; range elimination is an additional filter | FR-6, AC-8 |
| OQ-3 | If a two-digit year fits several centuries inside the range, which one wins? | The century whose date is closest to today | FR-9 |
| OQ-4 | When the native picker sets a date, should the text field be filled with the formatted date (`25 May 2024`)? | Yes, fill the text field with the preferred display text so both fields agree | FR-18 |
| OQ-5 | Exactly one in-range date but the input is not "finished" (e.g. `255` could still grow) — is it already `complete`? | `complete` means exactly one date is possible; `255` is `partial` because more digits could extend the year | FR-14 |
| OQ-6 | Presentation when several in-range dates remain equally preferred (only possible with wide ranges and two-digit years) | Show the preferred one plus a count, e.g. `25 May 24 (2 readings)`; do not fill the date input | FR-14, FR-18 |
| OQ-7 | How detailed may the "why was this reading dropped" messages be? | Short human sentence; the status is authoritative, wording is free | FR-12 |
| OQ-8 | Range bound `'now'`: local date or UTC date? Re-evaluated per keystroke? | Local calendar date, re-evaluated per parse | FR-11 |
| OQ-9 | Should invalid characters be blocked as they are typed? | No — accept the value, flag `invalid` | FR-3 |
| OQ-10 | Distribution shape: factory function on plain DOM, or a custom element? | Factory function (smaller, easier to test, no shadow DOM) | FR-20 |
| OQ-11 | Is `ambiguous` ever reachable with the default preference rules, or is "not enough information" the only ambiguity state? | Keep `ambiguous` for complete-but-multiple readings; `undetermined` stays for "no reading yet" | FR-10, FR-14 |
