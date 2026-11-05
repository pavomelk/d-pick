# Requirements — Incremental Segmented Date Parser

Status: **draft v0.2** — v0.1 (from `problem_statement.md`) revised against the clarifications in §10;
OQ-1 and OQ-3 are decided, OQ-2 and OQ-4 are still open (§11).
Sources: [`problem_statement.md`](problem_statement.md), clarifications C1–C11 (§10).
Notation: **C#** clarification (§10) · **AC-#** acceptance scenario (§5) · **OQ-#** open question (§11) · **A-#** assumption (§11).

Priorities: **MUST** = needed for the first working version · **SHOULD** = expected, unless clearly too costly · **MAY** = optional.

## 1. Purpose

The component helps a person type a date into a plain `<input type="text">`.
On every text change it re-reads the whole value, eliminates readings that the entered characters and the
configured date range make impossible, and immediately shows how the input is currently understood
(using month names). The text field sits next to a normal `<input type="date">`, whose native calendar
picker stays usable for the same date.

The component never guesses silently: when the input can honestly be read in several ways it says so, and
lets the user walk through the possibilities (C6) and confirm the one they meant (C5).

## 2. Goals and non-goals

Goals

- G1 Digit-only entry is enough: `2`,`5`,`5`,`2`,`4` can resolve to `25 May 2024`.
- G2 Ambiguity is resolved by elimination, not by a fixed format: the same prefix can be read as
  month-first or day-first and the interpretation may change while the user types.
- G3 The current reading is always visible, so the user sees early when the parser went down the wrong path.
- G4 Only dates inside an application-defined range can ever be produced.
- G5 Alternatives are reachable and a derived date can be confirmed, without the user completing the
  input by hand (C5, C6).

Non-goals for v1

- Time of day, time zones, durations.
- Locales other than English (`May`, not `mai`/`Mai`).
- Free-form natural language ("tomorrow", "next fri").
- Replacing or restyling the native date picker.
- Rewriting the text field *while the user is typing* (the typed value stays exactly as typed; rewriting
  happens only on commit, FR-17/FR-24).
- Year-first parsing of typed input (`YYYY-MM-DD` is not read as a year-first date; see OQ-2).
- Mobile-specific keypads or native date-keyboard hints.

## 3. Terms

- **Part** — one of day, month, year.
- **Segment** — a maximal run of digits, or a maximal run of letters, in the input (separators and the
  digit↔letter transition both end a segment).
- **Segmentation** — a split of the input into segments plus the endianness that orders them.
- **Candidate** — one complete reading: a segmentation with concrete values (including the century of a
  two-digit year) that is a real, in-range calendar date.
- **Partial candidate** — a reading that is still incomplete (a part missing or a segment cut off) but can
  still become a candidate by typing more characters.
- **Reading (interpretation)** — a candidate or partial candidate the component presents.
- **Reading list** — all readings of the current value, best first (FR-15).
- **Commit** — turning the presented reading into a fixed value: Enter (FR-16), a native-picker selection
  (FR-27) or a blur reset (FR-25).
- **Reparse** — building all readings from scratch from the current text value.

## 4. Functional requirements

### 4.1 Input and characters

- **FR-1 (MUST)** Parse incrementally: on every text change of the text input (`input` event, including
  typing, deleting, paste, drag-and-drop, IME commit, autofill) the component re-evaluates the whole
  current value. The result MUST depend only on the current value, the configured range and the frozen
  `'now'` (FR-18) — no hidden state from previous keystrokes. Re-entering the same string therefore gives
  the same result, and a programmatic write (FR-17, FR-24, FR-27) is guarded so it does not create a
  second, different interpretation.
- **FR-2 (MUST)** The only characters that may enter the text field are: decimal digits `0-9`, ASCII
  letters, and the separators `.`, `-`, `/`, `,` and whitespace (space, tab) (C9). Any other
  character MUST be blocked before insertion (`beforeinput` prevention) and stripped from pasted,
  dragged or autofilled text; the rest of the inserted text is kept (`2#5` → `25`). Blocking MUST NOT
  block typed letters (they are needed for month names) and MUST NOT move the caret.
- **FR-3 (MUST)** A letter run is matched case-insensitively against English month names — full
  (`september`), abbreviated (`sep`, `sept`) and, while the user is still typing, as a *prefix*
  (`septem`). A run that is a prefix of several months (`ju` → June, July) yields one reading per month
  (FR-9). A run that matches no month name at all makes the value `invalid` (FR-20); the typed value is
  still never modified.
- **FR-4 (MUST)** Segments end at a digit↔letter transition and at every separator (`.` `-` `/` `,`
  whitespace). Separators are **hard boundaries** (C1): once the value contains one, every run between
  separators is exactly one segment and is never merged with, or re-split across, a neighbour — `255/24`
  cannot become `2|55|24`. A comma counts as a boundary as well, so the `MMMM, dd YYYY` display form
  written back into the field parses as three segments (FR-17). A run of separators counts as one, and
  leading or trailing separators are ignored. Only a value with no separator in it is split freely (FR-6).
- **FR-5 (MUST)** The typed value is never rewritten, reformatted, trimmed or reordered while the user is
  typing; only a commit (FR-17) may replace it.

### 4.2 Segmentation and parsing

- **FR-6 (MUST)** A digit run that no separator delimits may be split at any interior position; each split
  is a separate segmentation and every one is evaluated (this is what makes `52524` and `25524` work).
  A reading then assigns the segments, in their given order, to parts in the order fixed by the endianness
  (FR-12): day → month → year (little-endian) or month → day → year (middle-endian).
  No part may repeat, no part may be skipped, and the year part may be absent (day and month may not: a
  reading without both is not usable, FR-14). An explicit month name fixes the month part (FR-3).
- **FR-7 (MUST)** Per-part validity:
  - day: 1–2 digits, value 1–31;
  - month: 1–2 digits, value 1–12, or a letter run per FR-3;
  - year: exactly 2 or 4 digits (FR-10).
  A 1-digit segment is valid whenever the segmentation (or a following boundary) makes it one.
- **FR-8 (MUST)** Values are checked as a whole, not part by part: a segmentation whose combination is
  not a real calendar date (`31/2/2024`, `29/2/2023`) produces no reading.
- **FR-9 (MUST)** A letter run that matches several months produces one reading per month; only the
  months that survive FR-11 remain.
- **FR-10 (MUST)** Years of 1 or 3 digits are never year segments; a segmentation that needs one is
  impossible. This — not the date range — is what eliminates the `02-05` reading of AC-8 (C2).
  Two-digit years are expanded to a century per FR-13; four-digit years are used literally.

### 4.3 Elimination and preference

- **FR-11 (MUST)** Eliminate a partial candidate as soon as no completion of it is an in-range calendar
  date (FR-18), including the century choice for a two-digit year. A partial candidate survives only
  while at least one in-range completion exists, so a reading the user can still finish is never hidden.
- **FR-12 (MUST)** Only little-endian (day-month-year) and middle-endian (month-day-year) are supported,
  and little-endian is preferred **strictly**: if at least one little-endian reading survives FR-11, a
  little-endian reading is presented and no middle-endian one is; middle-endian appears only when every
  little-endian reading has been eliminated (the visible consequence is in AC-2, and it is a decision,
  not an oversight: OQ-1 in §11).
- **FR-13 (MUST)** Derive the century of a two-digit year from the allowed range (C3): let the year take
  the values `yy + 100*c` and keep the centuries `c` whose resulting date is inside the range. Among the
  survivors, the one closest to the frozen `'now'` is the preferred reading; the other surviving
  centuries remain in the reading list as alternatives (AC-19). If no century is in range, the
  candidate is eliminated.
- **FR-14 (MUST)** Present "not enough information" instead of a date when no reading is strictly
  preferred — several readings remain with different day/month values, or the only readings are missing
  a part (FR-6). FR-12's endianness preference decides between readings that differ only in endianness;
  FR-13's closeness to today decides between readings that differ only in century (those are presented
  as the preferred reading plus alternatives, FR-15).

### 4.4 Reading list, navigation and confirmation

- **FR-15 (MUST)** Keep all readings in a deterministic, best-first order (preferred reading, then the
  remaining little-endian ones, then middle-endian, shorter/simpler segmentations first) and expose the
  list. While the list holds more than one reading, `ArrowDown` moves to the next reading and `ArrowUp`
  to the previous one, wrapping at the ends, and the feedback plus the structured result follow the
  selected reading (C6). Navigation MUST NOT change the text field's value, MUST NOT fight the caret, and
  MUST only be enabled when the list is small enough to be walked — an implementation cap (default 20,
  `maxReadings` option) — otherwise the keys behave natively.
- **FR-16 (MUST)** `Enter` confirms the presented reading (C5):
  - when the presented reading is a full date — status `complete`, or `ambiguous` with the presented
    reading being one of the full dates (FR-15) — that date is confirmed;
  - when the reading has no year segment and its day and month are determined (all surviving readings
    agree on day and month, both segments closed), today's year is proposed as the default year and the
    date is confirmed if that year is inside the range (AC-15); if today's year is outside the range,
    nothing is confirmed;
  - otherwise (year segment started but unfinished, reading `undetermined`/`ambiguous` without a
    determined day+month, `invalid`, `out-of-range`) `Enter` confirms nothing and the value is unchanged.
  A confirmed date is reported through `onConfirm(date)` with `YYYY-MM-DD`.
- **FR-17 (MUST)** A commit (FR-16, FR-27) makes the fields agree: the date input receives the confirmed
  `YYYY-MM-DD` value (unless the commit came from the date input itself), and the text input is rewritten
  with the `textFormat` pattern (FR-24) or, without one, with the display text of FR-20
  (`25 May 2024`, `May 25, 2024`). The rewritten value MUST re-parse to the same date (AC-17).

### 4.5 Date range

- **FR-18 (MUST)** The application configures an allowed range `{ from, to }`. Each bound may be
  `undefined` (unbounded), `'now'`, or an ISO date string `YYYY-MM-DD`. Bounds are inclusive. If both are
  given and `from > to`, construction fails with a `TypeError`.
  `'now'` means **the date at which the page was instantiated**: it is resolved once, when the component
  is created, and stays fixed for the lifetime of that component, so an open page does not silently gain
  or lose an allowed date at midnight (C8, AC-20). Tests inject the clock instead of reading it.
- **FR-19 (MUST)** The presentation must distinguish "not enough information", "ambiguous", "invalid" and
  "outside range". The visible feedback carries the reading and the status only; which readings were
  dropped, and why, is reported through the structured result (FR-22), not as prose in the live region
  (OQ-3, decided).

### 4.6 Feedback

- **FR-20 (MUST)** Report the current reading on every text change, ordered by the interpretation and
  using month names (C4):
  - middle-endian, complete → `May 25, 2024`
  - little-endian, complete → `25 May 2024`
  - a part that is missing entirely appears as an ellipsis in its position, after the separator that
    would precede it: `525` → `May 25 …`, `25 sep` → `25 September …`;
  - an unfinished year shows the digits it already implies followed by an ellipsis, with no space:
    `5252` → `May 25, 202…` (century `20` implied, `2` typed, one digit still missing), `2552` →
    `25 May 202…`, `25 May 2` → `25 May 202…`;
  - no usable reading → `Not enough information`
  When `ArrowDown` has selected a reading out of several, the selection is visible (e.g. `5 May 1905
  (2 of 2)`) so the user knows they left the preferred reading. Typography is an implementation detail;
  month names, ordering and the visible level of completeness are required.
- **FR-21 (MUST)** Report a machine-readable status alongside the text: `empty`, `undetermined` (not
  enough information), `partial` (one preferred reading, still incomplete), `complete` (exactly one
  in-range date), `ambiguous` (several in-range dates that only differ by century or month resolution,
  presented best-first), `invalid` (input that can never form a date), `out-of-range` (readings were
  eliminated only by the range: with the range filter removed a well-formed reading exists).
- **FR-22 (MUST)** Expose the structured result, not only text: status, the chosen date (`YYYY-MM-DD` or
  `null`), endianness, per-part values and digit spans, the index of the presented reading, and the
  reading list. The demo page renders it.
- **FR-23 (MUST)** Accessibility: the feedback element is announced politely (`role="status"` /
  `aria-live="polite"`), the component is fully usable with the keyboard alone, the selected reading is
  not conveyed by colour alone, and the text input carries a description of the expected entry.

### 4.7 Text-field format and reset

- **FR-24 (MUST)** A `textFormat` option converts the text field's value on commit (C4): a standard
  pattern such as `d-m-YYYY`, `DD-MM-YYYY`, `MM-DD-YY`, `d.m.YYYY` or `d MMMM YYYY`. Tokens are
  case-insensitive and repeat-count driven: 1 letter = day/month without padding (`d`, `M`), 2 = padded
  numeric (`DD`, `MM`), 3 = abbreviated month name (`MMM`), 4 = full month name (`MMMM`), `YY` = 2-digit
  year, `YYYY` = 4-digit year. Separators are copied literally; anything else in the pattern is a
  `TypeError` at construction. Without `textFormat`, FR-17's display text is used. The prediction in the
  feedback always uses FR-20's forms, never the pattern. Patterns whose value would not re-parse are not
  supported in v1 (OQ-2).
- **FR-25 (MUST)** When the text field loses focus (blur) with a value that is not unambiguously
  interpreted — i.e. status other than `complete` — the text field is reset to the `defaultValue` option
  and the date input is cleared, so a half-typed date never stays behind looking like a value (C11,
  AC-18). `defaultValue` defaults to `undefined`, which clears the field. A value that is already
  `complete`, and an empty field, are left alone.

### 4.8 Integration with `<input type="date">`

- **FR-26 (MUST)** The component attaches to an existing `<input type="text">` for typing and to an
  optional existing `<input type="date">` whose native picker stays available (C-statement). It MUST NOT
  replace, hide or rebuild the date input, and MUST NOT ship its own picker.
- **FR-27 (MUST)** Keep both fields consistent: a commit (FR-17) writes the date input; a native-picker
  change presents that date as the current reading and fills the text input per FR-17/FR-24; programmatic
  writes must not loop, and an unconfirmed `ambiguous` or `partial` reading never writes the date input.
- **FR-28 (SHOULD)** The date input's `min`/`max` are kept in sync with the resolved range (omitted for
  an absent bound; a frozen `'now'` bound yields a fixed date), and the host gets a way to open the
  native picker on request.

### 4.9 API and packaging

- **FR-29 (MUST)** The public entry point is a factory (C10):

  ```js
  const parser = createIncrementalDateParser({
    textInput,        // required HTMLInputElement (type="text")
    dateInput,        // optional HTMLInputElement (type="date")
    feedback,         // optional element, or (reading) => void renderer
    range: { from: '1972-02-05', to: 'now' }, // either bound optional
    textFormat: undefined,   // e.g. 'd-m-YYYY'   (FR-24)
    defaultValue: undefined, // written on blur reset (FR-25)
    maxReadings: 20,         // ArrowDown cap (FR-15)
    onReadingChange,         // optional (reading) => void
    onConfirm,               // optional (isoDate) => void
  });
  parser.destroy();          // removes listeners, restores attributes it added
  ```

  Option names are settled in the design step; the capabilities are not.

## 5. Behaviour to reproduce (acceptance scenarios)

Base scenario: range `from = 1972-02-05`, `to = 'now'`, page instantiated on **2026-11-04**, so the frozen
`to` is 2026-11-04.

**AC-1 … AC-5 — digits resolving to a middle-endian date (source example 1)**

| step | value   | status         | reading                   | note                                                                    |
| ---- | ------- | -------------- | ------------------------- | ----------------------------------------------------------------------- |
| 1    | `5`     | `undetermined` | Not enough information    | one digit can be a day or a month, the other part is missing            |
| 2    | `52`    | `partial`      | `5 February …`            | strict FR-12: the little-endian day-5/month-2 split survives, so `May 2…` is not shown (OQ-1: decided) |
| 3    | `525`   | `partial`      | `May 25 …`                | no little-endian split is valid (month 25, day 52), so middle-endian wins |
| 4    | `5252`  | `partial`      | `May 25, 202…`            | year segment unfinished; 2052/1952 are both out of range                |
| 5    | `52524` | `complete`     | `May 25, 2024`            | one in-range date; the date input gets 2024-05-25                        |

**AC-6 … AC-10 — digits resolving to a little-endian date (source example 2)**

| step | value   | status         | reading                | note                                                          |
| ---- | ------- | -------------- | ---------------------- | ------------------------------------------------------------- |
| 6    | `2`     | `undetermined` | Not enough information |                                                               |
| 7    | `25`    | `undetermined` | Not enough information | still readable as day 25, or day 2 + month 5                   |
| 8    | `255`   | `partial`      | `25 May …`             | month-first needs a 1-digit year, which never is a year (C2)   |
| 9    | `2552`  | `partial`      | `25 May 202…`          | century 20 implied, one year digit typed                      |
| 10   | `25524` | `complete`     | `25 May 2024`          | the date input gets 2024-05-25                                 |

**AC-11 — range elimination**: with range `2020-01-01 … 2020-12-31`, `31122019` is `out-of-range` (the only
reading, 2019-12-31, is a real date that the range excludes) and `311220` is `complete` → `31 December
2020` (a two-digit year is already complete, and the range leaves only 2020).

**AC-12 — month names**: `25 sep` → `partial`, `25 September …`; `25 ju` → `undetermined` with the June
and July readings; `25 september 2024` → `complete`, `25 September 2024`.

**AC-13 — separators are hard boundaries (C1)**

| value        | status     | reading          | note                                        |
| ------------ | ---------- | ---------------- | ------------------------------------------- |
| `25/5/2024`  | `complete` | `25 May 2024`    | one-digit month allowed because `/` closes it |
| `5.25.2024`  | `complete` | `May 25, 2024`   | little-endian would need month 25 → middle-endian |
| `25-5-24`    | `complete` | `25 May 2024`    | century from the range (1924 is out)        |
| `255/24`     | `invalid`  | Not enough information | `255` cannot be re-split across `/`    |

**AC-14 — characters are blocked, not accepted (C9)**: typing `#` leaves the value unchanged; pasting
`2#5` yields `25`; `xyz` stays in the field but is `invalid` (no month name matches).

**AC-15 — Enter proposes the current year (C5)**: `25 Sep` is `partial` → `25 September …`; `Enter`
proposes 2026, confirms 2026-09-25, fires `onConfirm('2026-09-25')`, rewrites the text field to
`25 September 2026` and sets the date input. With a range ending 2020-12-31, the same `Enter` confirms
nothing.

**AC-16 — Enter does not invent a started year**: `25 May 2` (`partial`, `25 May 202…`) → `Enter` does
nothing, because the year could still be 2020…2029; after `0` the value `25 May 20` is `complete` →
`25 May 2020`, and `Enter` confirms 2020-05-25.

**AC-17 — `textFormat` (C4)**: with `textFormat: 'd-m-YYYY'`, a picker selection of 2024-05-25 leaves
`25-5-2024` in the text field while the feedback still reads `25 May 2024`, and re-typing/confirming
`25/5/24` rewrites the field to `25-5-2024`; that value re-parses to `complete`, 2024-05-25.

**AC-18 — blur resets an unconfirmed value (C11)**: type `25 Sep` (status `partial`) and Tab away: the
text field is cleared (`defaultValue` undefined) and the date input too. Typing `25524` and tabbing away
keeps `25524` and 2024-05-25, because the reading is `complete`.

**AC-19 — ArrowDown walks the readings (C6)**: with range `1900-01-01 … now`, `5/5/05` is `ambiguous`:
preferred `5 May 2005`, alternative `5 May 1905`; `ArrowDown` switches the feedback and the structured
result to `5 May 1905 (2 of 2)`, the text field is untouched, and `Enter` then confirms 1905-05-05.

**AC-20 — `'now'` is frozen (C8)**: a component created on 2026-11-04 still rejects 2026-11-05 as
`out-of-range` on 2026-11-06 (clock injected in the test), and `max` on the date input stays 2026-11-04.

## 6. Non-functional requirements

- **NFR-1** No runtime dependency; plain ES modules, no transpiling, no bundling required to use the
  component. Vite is development tooling only.
- **NFR-2** Core logic is pure and DOM-free (`parse(value, { range, now })` → status + readings;
  `formatDate`/`formatWithPattern` → strings), so it can be unit tested in Node without a browser; a thin
  binding layer owns DOM events, blocking and rewriting.
- **NFR-3** Deterministic and fast enough for every keystroke: a small combinatorial search, no frame
  budget exceeded for normal inputs (cap input length at 64 characters, e.g. by truncating the value).
  The reading list is capped by `maxReadings` so ArrowDown stays usable.
- **NFR-4** Test-first: every rule in §4 and every scenario in §5 is covered by a failing test before it is
  implemented (`node --test`, no test framework dependency).
- **NFR-5** The demo page (`index.html`, served by Vite) imports the source modules directly, "as is"; no
  minified or transpiled artefacts are used in it, and it keeps working throughout the session.

## 7. Testing plan (tests written before code)

1. Segmentation per FR-4/FR-7: `5`, `52`, `525`, `5252`, `52524`, `2`, `25`, `255`, `2552`, `25524`,
   separator-pinned values (`25/5/2024`, `5.25.2024`, `255/24`, trailing `25/`), digit↔letter transitions.
2. Endianness preference (FR-12) and "not enough information" (FR-14), including the AC-2 consequence.
3. Range elimination (FR-11) for partial candidates; bounds `undefined`/`'now'`/ISO; `'now'` frozen
   (FR-18); invalid ranges.
4. Century derivation (FR-13) with ranges spanning one and two centuries; preferred vs alternative.
5. Month names, abbreviations, prefixes and ambiguous prefixes (FR-3, FR-9).
6. Character blocking and paste sanitising (FR-2) in the DOM layer; unmatched letters → `invalid`.
7. Status vocabulary and feedback text (FR-20, FR-21), ellipsis positions, selected-reading marker.
8. Reading list order and ArrowDown/ArrowUp cycling, cap (FR-15); Enter confirmation matrix (FR-16).
9. `textFormat` rendering for each token and round-trip re-parse (FR-24); blur reset with and without
   `defaultValue` (FR-25).
10. Page binding: `input`, paste, deletion, completion → date input value, picker → reading and text,
    no write loops, `destroy()` removes listeners (FR-1, FR-26 … FR-28).

## 8. Out of scope for this version

- Year-first typed input (`2024-05-25` typed by the user), and therefore year-first `textFormat` patterns
  (OQ-2), era/BC, week numbers.
- Locales other than English, free-form text, time of day.
- Reformatting or correcting the value while typing (commit-time conversion is in scope, FR-24).
- Persistence, form serialisation helpers, framework wrappers, a custom picker.

## 9. Traceability to the problem statement

| Statement sentence                                                        | Requirements          |
| ------------------------------------------------------------------------- | --------------------- |
| incrementally parse … by analyzing consecutively entered digit or letter  | FR-1, FR-2, FR-3, FR-7 |
| eliminate possibilities of misinterpreting input                          | FR-11, FR-12, FR-14   |
| middle-endian and little-endian only                                      | FR-12                 |
| two-digit year, derive century                                            | FR-10, FR-13          |
| application-specified date range rules out impossible dates               | FR-11, FR-18          |
| `<input type="text">` next to `<input type="date">` with its picker        | FR-26, FR-27, FR-28   |
| visual feedback on every text change                                      | FR-20, FR-21          |
| month names in the interpretation                                         | FR-3, FR-20           |
| prefer little-endian over middle-endian                                   | FR-12                 |
| bounds may be undefined or `'now'`, upper ≥ lower                         | FR-18                 |
| the two worked examples                                                   | AC-1 … AC-10          |

## 10. Clarifications (decisions log)

| #   | clarification (as given)                                                                                                                    | decision now normative in the document                                                                                          | requirements                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| C1  | "User may use separators such as dot, dash or slash and they indeed should mean segment boundaries"                                          | `.`, `-`, `/`, whitespace are hard boundaries; segments are never re-split across them (commas accepted but not boundaries)       | FR-4, AC-13                 |
| C2  | "Source example has logical error. It was meant to communicate the idea but happen to be far from perfect"                                    | The worked examples are illustrative only; the year-length rule (2 or 4 digits) is normative, the "range" wording is dropped        | FR-10, AC-8                 |
| C3  | "The century should indeed be assumed to be closest to today"                                                                                | Preferred century = closest in-range century to the frozen `'now'`; other in-range centuries stay as alternatives                 | FR-13, FR-14, AC-19         |
| C4  | "Date format in the text field should be converted according to the pattern … ('d-m-YYYY', 'MM-DD-YY' etc.) … during parsing and prediction, the guessed text should be presented as 'dd MMMM YYYY' or 'MMMM, dd YYYY'" | `textFormat` token pattern applied on commit only; prediction always uses `dd MMMM YYYY` / `MMMM, dd YYYY`                        | FR-20, FR-24, AC-17         |
| C5  | "… user can confirm input by pressing 'Enter', moreover when day and month is determined, the component should propose current year by default (if allowed date range permits this)" | Enter confirms; a missing year is filled with today's year when day+month are determined and that year is in range                 | FR-16, FR-17, AC-15, AC-16  |
| C6  | "if reasonably small number of possible readings can be made, allow user to scroll through them by him pressing 'ArrowDown'"                    | Best-first reading list walked with ArrowDown/ArrowUp, capped by `maxReadings`, marking the selected alternative                  | FR-15, FR-20, FR-22, AC-19  |
| C7  | "Will need you to be clarify your question."                                                                                                  | Former OQ-7 re-asked in concrete terms (three options) and answered: no explanation prose in the feedback, detail goes to the structured result | OQ-3, FR-19, FR-22          |
| C8  | "Range bound 'now' means the date at which the web page was instantiated. Should be fairly static value"                                      | `'now'` is resolved once at construction and never re-evaluated; clock injectable for tests                                       | FR-18, AC-20                |
| C9  | "Yes, invalid characters should be blocked."                                                                                                  | Disallowed characters are prevented on input and stripped from pasted text; letters stay allowed for month names                  | FR-2, AC-14                 |
| C10 | "Yes, factory function."                                                                                                                      | Factory over plain DOM, no custom element, no shadow DOM                                                                          | FR-29                       |
| C11 | "If user leaves control without unambigously interpreted values, the value should be set to default, which is 'undefined', unless specified explicity as an option parameter" | Blur resets anything that is not `complete` to `defaultValue` (default: cleared) and clears the date input                        | FR-25, AC-18                |

## 11. Assumptions and questions

Assumptions (implemented as stated; say so if one is wrong)

- **A-1** `textFormat` tokens are case-insensitive and driven by repeat count, so both `d-m-YYYY` and
  `DD-MM-YY` from C4 work; letters are the only token characters, so `T`/`Z`-style literals are rejected.
- **A-2** "Reasonably small number of readings" is a cap (default 20); above it ArrowDown keeps its native
  effect and the list is still exposed programmatically.
- **A-3** `defaultValue` is written verbatim into the text field (normally the empty string).

Questions — answered ones are kept here so the FR references stay stable

| id   | question                                                                                                                                                                                                                                    | decision                                                                                                  | status   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------- |
| OQ-1 | Is the little-endian preference really absolute? Applying FR-12 strictly means `52` shows `5 February …` and `1225` completes as `1 February 2025`, never `May 2…` / `December 25…`. Or should middle-endian come back whenever its reading is *more* plausible? | Keep it absolute: preference is not a plausibility vote (the statement says "prefer", and C2 distrusts the examples) | decided  |
| OQ-2 | `textFormat` with a year-first pattern such as `YYYY-MM-DD` writes a value the parser cannot read back (year-first input is out of scope). Support year-first patterns (and year-first parsing of committed values), or reject such patterns? | Reject year-first patterns with a `TypeError` in v1; keep the field re-parseable (FR-17)                  | open     |
| OQ-3 | (C7 return) What should the feedback explain besides the date? Option A: just the reading and status (`25 May …`). Option B: also why alternatives were dropped (`02-05 dropped: a 1-digit year is impossible`). Option C: B, but only on request (a details element / debug flag). | **A** — reading and status only; the structured result (FR-22) carries the detail, and the live region stays quiet | decided  |
| OQ-4 | C11's "default" — is it the text field's value (reset to `defaultValue` string, as specified in FR-25) or only the component's resolved date (text left as typed)?                                                                          | Reset the text field and clear the date input, so no half-typed date is left looking authoritative      | open     |
