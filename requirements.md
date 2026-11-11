# Requirements — Incremental Segmented Date Parser

Status: **v0.9 — frozen for implementation.** v0.1 (from `problem_statement.md`) revised against the
clarifications in §10; OQ-1 … OQ-5 and the C14–C32 review decisions are decided (§11).
Sources: [`problem_statement.md`](problem_statement.md), clarifications C1–C32 (§10).
Notation: **C#** clarification (§10) · **AC-#** acceptance scenario (§5) · **OQ-#** question (§11) · **A-#** assumption (§11).

Priorities: **MUST** = needed for the first working version · **SHOULD** = expected, unless clearly too costly · **MAY** = optional.

## 1. Purpose

The component helps a person type a date into a plain `<input type="text">`.
On every text change it re-reads the whole value, eliminates readings that the entered characters and the
configured date range make impossible, and immediately shows how the input is currently understood
(using month names). The text field sits next to a normal `<input type="date">`, whose native calendar
picker stays usable for the same date.

The component never guesses silently: when the input can honestly be read in several ways it says so, and
lets the user walk through the possibilities (C6) and confirm the one they meant (C5).

**Driving principle (C18).** Make the earliest assumption the entered characters allow, as soon as it
contradicts none of the rules (calendar validity, the configured range, segmentation and endianness).
The component does not wait for more input when one reading is already consistent; it revises that
reading only when later characters eliminate it.

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
- Year-first dates: a typed `YYYY-MM-DD` is not read as a year-first date, and `textFormat` cannot write
  that form (OQ-2, A-4, FR-24).
- Mobile-specific keypads or native date-keyboard hints.

## 3. Terms

- **Part** — one of day, month, year.
- **Segment** — a maximal run of digits, or a maximal run of letters, in the input (separators and the
  digit↔letter transition both end a segment).
- **Segmentation** — a split of the input into segments plus the endianness that orders them.
- **Candidate** — one complete reading: a part assignment with concrete values (including the century of
  a short year) that is a real, in-range calendar date.
- **Partial candidate** — a reading that is still incomplete (a part missing or a segment cut off) but can
  still become a candidate by typing more characters.
- **Reading (interpretation)** — a candidate or partial candidate the component presents.
- **Reading list** — all readings of the current value, best first (FR-15).
- **Commit** — turning the presented reading into a fixed value: Enter (FR-16), a native-picker selection
  (FR-27) or leaving the text field (FR-25).
- **Segment confirmation** — ending a run with non-Tab whitespace, which fixes the current guess for that run (a
  unique month prefix becomes that month) without committing the date or rewriting the text (C22).
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
  letters, and the separators `.`, `-`, `/`, `,` and whitespace other than Tab (space; C9, C28). Tab
  MUST NOT be inserted or treated as a separator; it keeps its native focus movement. Any other
  character MUST be blocked before insertion (`beforeinput` prevention) and stripped from pasted,
  dragged or autofilled text; the rest of the inserted text is kept (`2#5` → `25`, `25\t5\t2024` →
  `2552024`). Blocking MUST NOT block typed letters (they are needed for month names) and MUST NOT
  move the caret.
- **FR-3 (MUST)** A letter run is matched case-insensitively against English month names — full
  (`september`), abbreviated (`sep`, `sept`) and, while the user is still typing, as a *prefix*
  (`septem`). A run that is a prefix of several months (`ju` → June, July) yields one reading per month
  (FR-9). A run that matches no month name at all makes the value `invalid` (FR-20); the typed value is
  still never modified. Non-Tab whitespace after the run confirms it as the current guess (C22): a unique prefix
  is completed to its month (`N` + space is November), an ambiguous prefix is not decided by the space
  (`Ju` + space still has June and July as readings, with June preferred and ArrowDown reaching July),
  and the typed text is not rewritten (FR-5).
- **FR-4 (MUST)** Segments end at a digit↔letter transition and at every separator (`.` `-` `/` `,`
  and non-Tab whitespace). Separators are **hard boundaries** (C1): once the value contains one, every
  run after the first is exactly one segment and exactly one part — it is never merged with, or re-split
  across, a neighbour — while the first run keeps the cut the component was already showing (C32). Thus
  `255/24` is `25|5/24` → 25 May 2024, but the later `345` in `25/345` is not re-split. A comma counts as a boundary as well, so the `MMMM, dd YYYY` display form
  written back into the field parses as three segments (FR-17). A run of separators counts as one, and
  leading or trailing separators are ignored. A value with no separator in it, and the first run before
  a separator, are split freely (FR-6). Non-Tab whitespace is also the confirmation gesture for the run
  before it (C22); the other separators are only boundaries.
- **FR-5 (MUST)** The typed value is never rewritten, reformatted, trimmed or reordered while the user is
  typing; only a commit (FR-17) may replace it.

### 4.2 Segmentation and parsing

- **FR-6 (MUST)** The cut is **committed**, not enumerated (C16): the parts are filled left to right in
  the order fixed by the endianness (FR-12) — day → month → year (little-endian) or month → day → year
  (middle-endian) — and a part that has taken its digits is never re-split as more digits arrive.
  - Day and month take two digits whenever those two digits are valid for that part, and one only when
    two would not: `52` is day 5 + month 2, `1225` is day 12 + month 2 + year 5, `25524` is 25|5|24; and
    since the day is committed first, `255` is 25|5 (never 2|5|5) and `112` is 11|2 (never 1|12). The
    year is the last part: it takes all remaining digits (up to four) and may grow as more arrive, while
    a committed day or month never changes. A run is read as a year only when the day and month
    positions are already filled: a value starting `05` is day 5 with the month still missing, not the
    year 2005 (C24).
  - A free digit run therefore yields exactly one cut per endianness. When separators follow, the first
    run keeps the cut of the reading preferred while it was alone, and each later run supplies exactly
    one part (FR-4, C32).
  - The user steers the cut with a separator or a leading zero: `1225` and `12 2 5` both read 12|2|5,
    `1 2 25` reads 1|2|25, and `02305` reads 02|3|05 (AC-22). A separator also accepts the cut the
    component was showing, so `34` → `3 April …`, `34 ` stays, and `34 2` reads 3|4|2 (C32).
  - No part may repeat or be skipped, and the year part may be absent (day and month may not: a reading
    without both is not a candidate, though FR-14 still exposes the surviving partial reading). An
    explicit month name fixes the month part (FR-3); a month name in the first part position therefore
    forces middle-endian, and in the second part position it forces little-endian.
- **FR-7 (MUST)** Per-part validity:
  - day: 1–2 digits, value 1–31;
  - month: 1–2 digits, value 1–12, or a letter run per FR-3;
  - year: 1–4 digits, where four digits are a literal year and one to three are a year number (FR-10).
  A 1-digit part is valid whenever the committed cut makes it one.
- **FR-8 (MUST)** Values are checked as a whole, not part by part: a reading whose combination is not a
  real calendar date (`31/2/2024`, `29/2/2023`) is eliminated.
- **FR-9 (MUST)** A letter run that matches several months produces one reading per month; only the
  months that survive FR-11 remain.
- **FR-10 (MUST)** A year part of four digits is a literal year. A year part of one to three digits is a
  **year number**: it is the tail of the year, so `5` is `05`, `52` is `52`, `952` is `0952`, and the run
  is completed to the in-range year closest to the frozen `'now'` (FR-13, C17, C20). Such a reading is
  **complete** once that completion exists: with a range that admits them, `5` is the year 2005, `52`
  is 2052 and `952` is 1952 (AC-24). The year can still grow while the user types, so `5` → 2005 and
  `25` in year position → 2025.
  A run that no in-range year ends with is an **unfinished** year instead: it is a prefix of a four-digit
  year, the reading stays `partial`, and the feedback shows the digits its completions share (`202` →
  `25 May 202…`, AC-21). This is the only way a partial year appears, and a run survives only while one
  of its readings is in range (FR-11). A configured range still removes a completion outside it; among
  the centuries it leaves, the closest to `'now'` is preferred (FR-13).

### 4.3 Elimination and preference

- **FR-11 (MUST)** Eliminate a reading as soon as none of its completions is an in-range calendar date
  (FR-18) — including every century a short year could mean, and the four-digit years an unfinished year
  could still become. A reading survives only while at least one in-range completion exists, so a value
  the user can still finish is never hidden.
- **FR-12 (MUST)** Only little-endian (day-month-year) and middle-endian (month-day-year) are supported;
  big-endian (year-month-day) is never produced (C19). Little-endian is preferred **strictly**: if at
  least one little-endian reading survives FR-11, a little-endian reading is presented and no
  middle-endian one is; middle-endian appears only when every little-endian reading has been eliminated
  (the visible consequence is in AC-2, and it is a decision, not an oversight: OQ-1 in §11).
- **FR-13 (MUST)** Derive the century of a short year from the allowed range (C3, C17, C20): a one- or
  two-digit run `v` takes the values `v + 100*c` and a three-digit run the values `v + 1000*c`; keep the
  centuries whose resulting date is inside the range. Among the survivors, the one closest to the frozen
  `'now'` is the preferred reading (for `52` that is 2052, for `952` it is 1952, when those years are in
  range); the other surviving centuries remain in the reading list as alternatives (AC-19). If no
  century is in range, the run falls back to an unfinished year (FR-10).
- **FR-14 (MUST)** Present "not enough information" only when no reading can be anchored because the
  month is not determined (`25` is day 25 with the month still missing, `5` is day 5 for the same
  reason). When a month is determined, present the best partial reading even if the day or year is
  still missing: a uniquely identified month is shown immediately (`N` → `November`), and a letter run
  resolving to several months presents its preferred reading first with the others reachable by
  ArrowDown: calendar order, except a bare `J` is June, July, January (C26), so `J` → `June`,
  ArrowDown → `July`, and `25 ju` → `25 June …` (AC-12, AC-23). A determined day and month with only
  the year missing is `partial` too, because the year may be absent (FR-6).
  FR-12's endianness preference decides between readings that differ only in endianness; FR-13's
  closeness to today decides between readings that differ only in century (those are presented as the
  preferred reading plus alternatives, FR-15).

### 4.4 Reading list, navigation and confirmation

- **FR-15 (MUST)** Keep all readings in a deterministic, best-first order (preferred reading, then the
  remaining little-endian ones, then middle-endian; within a group complete readings before unfinished
  ones, then the century closest to today, then the month in the C26 order — calendar order except a
  bare `J`, which is June, July, January) and expose the list. While the list holds more than one reading, `ArrowDown` moves to the next reading and `ArrowUp`
  to the previous one, wrapping at the ends, and the feedback plus the structured result follow the
  selected reading (C6). Partial readings are part of that list and are walked like complete ones.
  Navigation MUST NOT change the text field's value, MUST NOT fight the caret, and MUST only be enabled
  while the whole list — complete and partial readings alike — is small enough to walk: it is capped at
  `maxReadings` (default 8) and above that cap the keys behave natively (C14). After `ArrowDown` has
  selected an alternative, a following separator (space, `.`, `-`, `/`, `,`) accepts that selection
  (C30): the selection survives the separator and later insertions, and later input completes the
  selected alternative instead of the preferred one (C30); a separator also accepts the preferred/current
  reading when no ArrowDown selection was made (C32). A short year that is being typed after acceptance
  stays open: the selected month and day remain fixed while the year digits move to the next
  completion, until the year run reaches four digits. For an already complete alternative, the
  separator only keeps it selected so blur or Enter commits it; it does not pin a new reading. An
  ordinary edit that was not accepted this way, and a deletion, return the selection to the preferred
  reading. `ArrowDown`/`ArrowUp` still wrap at the ends, so stepping past the last alternative returns
  to the initially preferred reading.
- **FR-16 (MUST)** `Enter` confirms the presented reading (C5):
  - when the presented reading is a full date — status `complete`, or `ambiguous` with the presented
    reading being one of the full dates (FR-15) — that date is confirmed;
  - a short year is a complete year (FR-10), so `25 May 2` is confirmed as 2002-05-25 like any other
    complete reading (AC-16);
  - when the reading has no year part and its day and month are determined (all surviving readings agree
    on day and month, both parts closed), today's year is proposed as the default year and the date is
    confirmed if that year is inside the range (AC-15); if today's year is outside the range, nothing is
    confirmed. If a separator accepted an alternative (C30), that selected reading is the one used for
    the day and month, even though other month alternatives remain in the list;
  - otherwise (year run unfinished, reading `partial`/`undetermined`/`ambiguous` without a determined
    day+month, `invalid`, `out-of-range`) `Enter` confirms nothing and the value is unchanged.
  A confirmed date is reported through `onConfirm(date)` with `YYYY-MM-DD`.
- **FR-17 (MUST)** A commit (FR-16, FR-25, FR-27) makes the fields agree: the date input receives the
  confirmed `YYYY-MM-DD` value (unless the commit came from the date input itself), and the text input is
  rewritten with the `textFormat` pattern (FR-24) or, without one, with the display text of FR-20
  (`25 May 2024`, `May 25, 2024`). The rewritten value MUST re-parse to the same date (AC-17). If a
  configured `YY` pattern cannot round-trip the confirmed date, that commit uses the display text
  instead (OQ-5 A, AC-28).

### 4.5 Date range

- **FR-18 (MUST)** The application configures an allowed range `{ from, to }`. Each bound may be
  `undefined` (unbounded), `'now'`, or an ISO date string `YYYY-MM-DD`. Bounds are inclusive. If both are
  given and `from > to`, construction fails with a `TypeError`.
  `'now'` means **the date at which the page was instantiated**: it is resolved once, when the component
  is created, and stays fixed for the lifetime of that component, so an open page does not silently gain
  or lose an allowed date at midnight (C8, AC-20). Tests inject the clock instead of reading it.
- **FR-19 (MUST)** The presentation must distinguish "not enough information", "ambiguous", "invalid" and
  "outside range"; an out-of-range value is shown as `Date out of range` and is never translated into a
  nearby valid date (C23). The visible feedback carries the reading and the status only; which readings
  were dropped, and why, is reported through the structured result (FR-22), not as prose in the live
  region (OQ-3, decided).

### 4.6 Feedback

- **FR-20 (MUST)** Report the current reading on every text change, ordered by the interpretation and
  using month names (C4):
  - middle-endian, complete → `May 25, 2024`
  - little-endian, complete → `25 May 2024`
  - a determined month with no day or year is shown alone: `N` → `November`, `J` → `June`;
  - a part that is missing entirely appears as an ellipsis in its position, after the separator that
    would precede it: `5/25` → `May 25 …`, `25 sep` → `25 September …`;
  - a short year (FR-10) is shown as the full year it resolves to: `2552` → `25 May 2002`, `25 May 2`
    → `25 May 2002`, `325` → `3 February 2005`;
  - an unfinished year (FR-10) shows the digits that all of its surviving completions share, followed
    by an ellipsis with no space: `25 May 202` → `25 May 202…` (no year in range ends in `202`, so the
    completions 2020-2026 decide the text);
  - `out-of-range` → `Date out of range` (the range is never relaxed to produce a date)
  - `undetermined` (month not determined) or `invalid` (no reading to show) → `Not enough information`
  - `empty` → no feedback text
  When `ArrowDown` has selected a reading out of several, the selection is visible (e.g. `5 May 1905
  (2 of 2)`) so the user knows they left the preferred reading. Typography is an implementation detail;
  month names, ordering and the visible level of completeness are required.
- **FR-21 (MUST)** Report a machine-readable status alongside the text: `empty`, `undetermined` (not
  enough information: no reading with a determined month can be presented), `partial` (a preferred
  reading exists but is incomplete; alternative incomplete readings may also be present and are walked
  with ArrowDown/Up), `complete` (exactly one in-range date), `ambiguous` (several *complete* in-range
  dates survive — differing only by century, e.g. `5/5/05`, or by the month a letter run resolves to
  once the year is known — presented best-first), `invalid` (input that can never form a date),
  `out-of-range` (readings were eliminated only by the range: with the range filter removed a
  well-formed reading exists; the feedback is `Date out of range` and `date` stays `null`).
- **FR-22 (MUST)** Expose the structured result, not only text: status, the chosen date (`YYYY-MM-DD` or
  `null`), endianness, per-part values and digit spans, the index of the presented reading, the reading
  list, and the highlighted suggestion string (FR-30). The demo page renders it.
- **FR-23 (MUST)** Accessibility: the feedback element is announced politely (`role="status"` /
  `aria-live="polite"`), the component is fully usable with the keyboard alone, the selected reading is
  not conveyed by colour alone, and the text input carries a description of the expected entry.

### 4.7 Text-field format and reset

- **FR-24 (MUST)** A `textFormat` option converts the text field's value on commit (C4): a standard
  pattern such as `d-m-YYYY`, `DD-MM-YYYY`, `MM-DD-YY`, `d.m.YYYY` or `d MMMM YYYY`. Tokens are
  case-insensitive and repeat-count driven: 1 letter = day/month without padding (`d`, `M`), 2 = padded
  numeric (`DD`, `MM`), 3 = abbreviated month name (`MMM`), 4 = full month name (`MMMM`), `YY` = 2-digit
  year, `YYYY` = 4-digit year. Separators are copied literally (Tab is not a separator; C28); anything
  else in the pattern is a `TypeError` at construction. Without `textFormat`, FR-17's display text is used. The prediction in the
  feedback always uses FR-20's forms, never the pattern. Year-first patterns (`YYYY-MM-DD`, `YY/MM/DD`)
  are rejected with a `TypeError` at construction (OQ-2): the value they write would not re-parse
  (FR-17), and users are not expected to type a year-first date (A-4). A `YY` token writes only the
  last two digits, so its re-parse always follows FR-13 (A-8); it is round-trip safe only for the
  preferred century. When the confirmed date lies in an alternative century, commit falls back to the
  FR-20 display text for that value rather than writing a pattern that would re-parse to another date
  (OQ-5 A, AC-28).
- **FR-25 (MUST)** Leaving the text field (blur) commits a reading that `Enter` can confirm, using the
  same path and the same proposed year as FR-16: the text is rewritten canonically, the date input is
  filled and `onConfirm` fires (C27, AC-18). An alternative kept selected by a separator is the reading
  blur confirms (C30). A value already committed by Enter or the picker is not confirmed again merely
  because focus leaves. A reading `Enter` cannot confirm (`partial` with an
  unfinished year, `undetermined`, `invalid`, `out-of-range`) is reset to the `defaultValue` option and
  the date input is cleared, so a half-typed date never stays behind looking like a value (C11, OQ-4,
  C21). `defaultValue` defaults to `undefined`, which clears the field; an empty field is left alone.
  The reset value is then treated like any other text change: it is reparsed and reported (FR-1), and if
  `defaultValue` itself is a complete date, FR-27 fills the date input from it; otherwise the date input
  stays empty. `Esc` cancels the current edit: it restores the last committed canonical text, or
  `defaultValue` if nothing has been committed, reparses and reports it, and does not fire `onConfirm`
  (C27, AC-26).

### 4.8 Integration with `<input type="date">`

- **FR-26 (MUST)** The component attaches to an existing `<input type="text">` for typing and to an
  optional existing `<input type="date">` whose native picker stays available (C-statement). It MUST NOT
  replace, hide or rebuild the date input, and MUST NOT ship its own picker.
- **FR-27 (MUST)** Keep both fields consistent: a commit (FR-17) writes the date input; a native-picker
  change presents that date as the current reading and fills the text input per FR-17/FR-24; programmatic
  writes must not loop. The date input carries a date only while the text resolves to exactly one: it is
  filled when the status becomes `complete` and cleared as soon as the status becomes anything else
  (further typing, deletion, `ambiguous`, `out-of-range`, `invalid`, the blur reset of FR-25), so a
  resolved date never sits beside text it no longer matches (C13, OQ-4, AC-21). The text field is never
  rewritten while typing (FR-5).
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
    defaultValue: undefined, // written on blur reset or Esc with no commit (FR-25)
    maxReadings: 8,          // ArrowDown cap (FR-15)
    onReadingChange,         // optional (reading) => void
    onConfirm,               // optional (isoDate) => void
  });
  parser.destroy();          // removes listeners, restores attributes it added
  ```

- **FR-30 (MUST)** Expose `highlighted`, an HTML string for the presented reading that keeps the user's
  matching input and emphasizes it with `<em>`:
  - numeric day, month and year parts keep the digits the user typed; a numeric month is followed
    immediately by the month name in parentheses: `2 4 52` (with a range that resolves the year to
    1952) → `<em>2</em>&nbsp;<em>4</em>(April)&nbsp;19<em>52</em>`;
  - a month typed as letters is shown as its full name with the matching prefix emphasized, preserving
    the month name's capitalization: `ja` → `<em>Ja</em>nuary`, `J` → `<em>J</em>une`;
  - separators follow the reading's endianness and use `&nbsp;`, with the same ellipsis, comma and
    month-alone rules as FR-20; a missing part is an unemphasized ellipsis;
  - message statuses (`empty`, `undetermined`, `invalid`, `out-of-range`) have no highlighted date
    (`highlighted` is `''`);
  - the string is safe to assign to `innerHTML`: it contains only known month names, fixed markup and
    escaped user digits.
  The demo page shows this string in a separate element, leaving the accessible feedback text unchanged
  (FR-23).

## 5. Behaviour to reproduce (acceptance scenarios)

Base scenario: range `from = 1972-02-05`, `to = 'now'`, page instantiated on **2026-11-04**, so the frozen
`to` is 2026-11-04.

**AC-1 … AC-5 — digits resolving to a middle-endian date (source example 1)**

With the cut committed day-first (C16) and a short year reading as a year (C17), the source's
month-first walkthrough holds only from the moment day-first has nothing left to work with; the earlier
steps commit to day-first (OQ-1, decided).

| step | value   | status         | reading                | note                                                                                    |
| ---- | ------- | -------------- | ---------------------- | --------------------------------------------------------------------------------------- |
| 1    | `5`     | `undetermined` | Not enough information | day 5 with the month still missing                                                       |
| 2    | `52`    | `partial`      | `5 February …`         | day 5 is committed (`52` is not a day), so month 2 follows (OQ-1: decided)               |
| 3    | `525`   | `complete`     | `5 February 2005`      | day 5 + month 2 + year 5 → 2005 (C17); the month-first reading is dropped by FR-12        |
| 4    | `5252`  | `complete`     | `May 25, 2002`         | day-first would need the year `52`, and no year in range ends in 52 → middle-endian      |
| 5    | `52524` | `complete`     | `May 25, 2024`         | one in-range date; the date input gets 2024-05-25                                        |

**AC-6 … AC-10 — digits resolving to a little-endian date (source example 2)**

| step | value   | status         | reading                | note                                                                                   |
| ---- | ------- | -------------- | ---------------------- | -------------------------------------------------------------------------------------- |
| 6    | `2`     | `undetermined` | Not enough information | day 2 with the month still missing                                                     |
| 7    | `25`    | `undetermined` | Not enough information | day 25 with the month still missing (`25` is not also read as day 2 + month 5, C16)     |
| 8    | `255`   | `partial`      | `25 May …`             | the day is committed at 25, so month 5 and no year yet                                  |
| 9    | `2552`  | `complete`     | `25 May 2002`          | year `2` is 2002 (1902 is out of range)                                                |
| 10   | `25524` | `complete`     | `25 May 2024`          | the date input gets 2024-05-25                                                         |

**AC-11 — range elimination**: with range `2020-01-01 … 2020-12-31`, `31122019` is `out-of-range` →
`Date out of range` (the only reading, 2019-12-31, is a real date that the range excludes, and no date
is produced) and `311220` is `complete` → `31 December 2020` (a two-digit year is already complete, and
the range leaves only 2020).

**AC-12 — month names**: `25 sep` → `partial`, `25 September …`; `25 ju` → `partial`, preferred
`25 June …`, with `ArrowDown` switching to `25 July …` (2 of 2); `25 september 2024` → `complete`,
`25 September 2024`.

**AC-13 — runs after the first separator are pinned (C1, C32)**

| value        | status     | reading          | note                                        |
| ------------ | ---------- | ---------------- | ------------------------------------------- |
| `25/5/2024`  | `complete` | `25 May 2024`    | one-digit month allowed because `/` closes it |
| `5.25.2024`  | `complete` | `May 25, 2024`   | little-endian would need month 25 → middle-endian |
| `25-5-24`    | `complete` | `25 May 2024`    | century from the range (1924 is out)        |
| `25/345`     | `invalid`  | Not enough information | the later run `345` cannot be a month and is not re-split |

**AC-14 — characters are blocked, not accepted (C9)**: typing `#` leaves the value unchanged; pasting
`2#5` yields `25`; `xyz` stays in the field but is `invalid` (no month name matches). Tab is never
inserted: it moves focus, and pasting `25\t5\t2024` strips the tabs to `2552024` (C28, AC-27).

**AC-15 — Enter proposes the current year (C5)**: `25 Sep` is `partial` → `25 September …`; `Enter`
proposes 2026, confirms 2026-09-25, fires `onConfirm('2026-09-25')`, rewrites the text field to
`25 September 2026` and sets the date input. With a range ending 2020-12-31, the same `Enter` confirms
nothing.

**AC-16 — a short year is read, an unfinished one is not invented**: `25 May 2` is `complete` →
`25 May 2002` (year `2` is 2002), and `Enter` confirms 2002-05-25. Where no in-range year ends with the
run — `25 May 202` — the reading stays `partial` → `25 May 202…` and `Enter` does nothing.

**AC-17 — `textFormat` (C4)**: with `textFormat: 'd-m-YYYY'`, a picker selection of 2024-05-25 leaves
`25-5-2024` in the text field while the feedback still reads `25 May 2024`, and re-typing/confirming
`25/5/24` rewrites the field to `25-5-2024`; that value re-parses to `complete`, 2024-05-25. With
`textFormat: 'YYYY-MM-DD'` construction throws a `TypeError`, so the field never holds a value the
component cannot read back.

**AC-18 — blur commits like Enter, otherwise resets (C11, C27)**: type `25524` and Tab away: it
confirms 2024-05-25, rewrites the text to `25 May 2024` and fills the date input. Type `25 Sep` and Tab
away: Enter's current-year proposal is used, so it confirms 2026-09-25 and rewrites to
`25 September 2026`. Type `25 May 202` and Tab away: the unfinished year cannot be confirmed, so the
text field is reset to `defaultValue` (cleared when undefined) and the date input is cleared. Typing
`25524`, pressing Enter and then tabbing away does not fire `onConfirm` twice.

**AC-19 — ArrowDown walks the readings (C6)**: with range `1900-01-01 … now`, `5/5/05` is `ambiguous`:
preferred `5 May 2005`, alternative `5 May 1905`; `ArrowDown` switches the feedback and the structured
result to `5 May 1905 (2 of 2)`, the text field is untouched, and `Enter` then confirms 1905-05-05.

**AC-20 — `'now'` is frozen (C8)**: a component created on 2026-11-04 still treats 2026-11-05 as
unreachable when the page is used on 2026-11-06 (clock injected in the test): `25/11/2026` is
`out-of-range` → `Date out of range` while `25/10/2026` is `complete`, and `max` on the date input stays
2026-11-04. The
example deliberately uses day 25: a `d/m` pair with both values ≤ 12, such as `5/11/2026`, keeps a
middle-endian reading (2026-05-11) that FR-11 and FR-12 let through, so it would not demonstrate the
frozen bound.

**AC-21 — an unresolved value clears the date input (OQ-4)**: confirm 2024-05-25, then edit the text to
`25 May 202` (`partial`): the date input is emptied immediately while the typed text stays exactly as
keyed; completing it back to `25 May 2024` refills the date input with 2024-05-25. Deleting everything
leaves both fields empty.

**AC-22 — the cut is committed, and separators and zeros steer it (C16, C17)**

| value      | status     | reading                | note                                                                 |
| ---------- | ---------- | ---------------------- | -------------------------------------------------------------------- |
| `1225`     | `complete` | `12 February 2005`     | day 12 is two valid digits → month 2 → year 5 (2005); not 1 February 2025 |
| `12 2 5`   | `complete` | `12 February 2005`     | a separator steers the cut, which is the same one as `1225` already  |
| `1 2 25`   | `complete` | `1 February 2025`      | a second separator pins the day at one digit                         |
| `02305`    | `complete` | `2 March 2005`         | the leading zero fills the day, so the cut is 02\|3\|05, not 0\|23\|05 |
| `2 5 23`   | `complete` | `2 May 2023`           |                                                                      |
| `112`      | `partial`  | `11 February …`        | day 11 is committed; it never becomes day 1 + month 12               |
| `25.5/2024`| `complete` | `25 May 2024`          | `.`, `/`, `-`, `,` and spaces are interchangeable separators         |

**AC-23 — month prefixes are presented immediately; space confirms them (C22, C25)**

| value        | status      | reading             | note                                                                    |
| ------------ | ----------- | ------------------- | ----------------------------------------------------------------------- |
| `N`          | `partial`   | `November`          | November is the only month starting with `N`; it is shown before the day |
| `N 25`       | `partial`   | `November 25 …`     | the space confirms November; `25` is then the day (middle-endian)       |
| `N 25 2024`  | `complete`  | `November 25, 2024` | one in-range date                                                       |
| `J`          | `partial`   | `June`              | June is preferred; `ArrowDown` gives `July` (2 of 3), then `January` (3 of 3) |
| `J 25`       | `partial`   | `June 25 …`         | `ArrowDown` gives `July 25 …` (2 of 3), then `January 25 …` (3 of 3)    |
| `Ju 25`      | `partial`   | `June 25 …`         | the space does not choose, but June is preferred and July is next       |
| `Ju 25 2024` | `ambiguous` | `June 25, 2024`     | June and July remain alternative complete readings                      |

**AC-24 — a short year follows the current century/millennium (C20)**: with range
`1900-01-01 … 2100-12-31`, `25 May 52` is `ambiguous` and prefers `25 May 2052` (1952 remains an
alternative), while `25 May 952` is `complete` → `25 May 1952`; the completion closest to the frozen
`now` is preferred. Under the base range both values are `out-of-range` → `Date out of range`, because
neither 2052 nor 1952 is inside it, and neither is rewritten into a valid nearby date.

**AC-25 — `05` is a day until the year position (C24)**: `05` is `undetermined` → `Not enough
information` (day 5, month missing), while `25 5 05` is `complete` → `25 May 2005` (day 25, month 5,
year position `05`).

**AC-26 — Esc cancels the edit (C27)**: confirm `25524` with Enter (`25 May 2024`), edit it to
`25 May 202` and press Esc: the text returns to `25 May 2024`, the date input stays filled and no
second `onConfirm` fires. With nothing committed and no `defaultValue`, Esc clears the field; with
`defaultValue: '1.1.2000'`, Esc restores `1.1.2000` and fills 2000-01-01.

**AC-27 — Tab is navigation, not content (C28)**: `25\t5\t2024` is `invalid` as a text value because
Tab is not a separator. In the DOM layer, Tab is never inserted, `keydown` Tab is not prevented (focus
moves natively), and pasting `25\t5\t2024` yields `2552024`.

**AC-28 — a `YY` commit never changes the date (OQ-5 A)**: with `textFormat: 'MM-DD-YY'` and range
`1900-01-01 … now`, `5/5/05` ArrowDown → 1905, then Enter (or blur) confirms 1905-05-05 and writes
`5 May 1905`, not `05-05-05`, because the pattern would re-parse as 2005. The preferred 2005 commit
writes `05-05-05` and re-parses to 2005-05-05.

**AC-30 — a separator accepts the selected alternative (C30)**: with the base range, type `J`,
`ArrowDown` → `July (2 of 3)`, then space: the selection stays on July. Typing `25` keeps it and
typing `2024` completes `July 25, 2024 (2 of 3)`; blur confirms 2024-07-25 and writes
`July 25, 2024`. With range `1900-01-01 … now`, `5/5/05` `ArrowDown` → `5 May 1905 (2 of 2)`, then a
separator keeps 1905 selected and blur confirms 1905-05-05. From `J`, `ArrowDown` twice reaches
`January (3 of 3)` and one more `ArrowDown` returns to the initial `June`. From `j`, `ArrowDown` twice,
space, `4`, space, `1` shows `January 4, 2001 (3 of 3)`; another `2` extends the short year to
`January 4, 2012 (3 of 3)` instead of reverting to June.

**AC-31 — highlighted suggestions keep and emphasize the typed input (C31)**: with range
`1900-01-01 … 2000-12-31`, `2 4 52` is `2 April 1952` and `highlighted` is
`<em>2</em>&nbsp;<em>4</em>(April)&nbsp;19<em>52</em>`. `ja` gives `<em>Ja</em>nuary`; `J` gives
`<em>J</em>une`; after `ArrowDown`, July gives `<em>J</em>uly`. `25/5/2024` gives
`<em>25</em>&nbsp;<em>5</em>(May)&nbsp;<em>2024</em>`, while `5/25/2024` gives
`<em>5</em>(May)&nbsp;<em>25</em>,&nbsp;<em>2024</em>`. A missing part is an unemphasized ellipsis
(`25 Sep` → `<em>25</em>&nbsp;<em>Sep</em>tember&nbsp;…`), and message statuses have an empty
`highlighted` string. The demo renders `highlighted` in a separate element.

**AC-32 — a separator accepts the current suggestion (C32)**: type `34` → `partial`, `3 April …`; a
space keeps that reading, and `2` then completes `3 April 2002`. `1225` followed by a space stays
`12 February 2005`. `255/24` is `25 May 2024`, and `312/2024` keeps the middle-endian March 12 reading
shown for `312` → `March 12, 2024`. Later runs stay pinned: `25/345` is `invalid`.

## 6. Non-functional requirements

- **NFR-1** No runtime dependency; plain ES modules, no transpiling, no bundling required to use the
  component. Vite is development tooling only.
- **NFR-2** Core logic is pure and DOM-free (`parse(value, { range, now })` → status + readings;
  `formatDate`/`formatWithPattern` → strings), so it can be unit tested in Node without a browser; a thin
  binding layer owns DOM events, blocking and rewriting.
- **NFR-3** Deterministic and fast enough for every keystroke: one committed cut per endianness (FR-6),
  so the cost is linear in the value's length plus a bounded century search (at most ~100 candidates per
  short year). No date is ever enumerated. The reading list is capped by `maxReadings` so ArrowDown stays
  usable.
- **NFR-4** Test-first: every rule in §4 and every scenario in §5 is covered by a failing test before it is
  implemented (`node --test`, no test framework dependency).
- **NFR-5** The demo page (`index.html`, served by Vite) imports the source modules directly, "as is"; no
  minified or transpiled artefacts are used in it, and it keeps working throughout the session.

## 7. Testing plan (tests written before code)

Each numbered group is one file under `test/` (`01-segmentation.test.js` … `10-dom-binding.test.js`), so a
failing test names the requirement it breaks from the first commit (C14).

1. Segmentation per FR-4/FR-6/FR-7: `5`, `05` (day 5, not the year 2005), `52`, `525`, `5252`, `52524`, `2`, `25`, `255`, `2552`,
   `25524`, the committed cut (`112`, `1225`), the steering levers (`12 2 5`, `1 2 25`, `02305`,
   `2 5 23`), separator-accepted cuts (`34 `, `34 2`, `255/24`, `312/2024`), later pinned runs
   (`25/5/2024`, `5.25.2024`, `25/345`, trailing `25/`), interchangeable separators (FR-2) and
   digit↔letter transitions.
2. Endianness preference (FR-12) and "not enough information" (FR-14), including the AC-2 consequence.
3. Range elimination (FR-11) for readings and unfinished years; bounds `undefined`/`'now'`/ISO; `'now'`
   frozen (FR-18); invalid ranges.
4. Short-year centuries (FR-13, C17, C20): `25 May 5` → 2005, and with a range that admits them the
   preferred completions `25 May 52` → 2052 and `25 May 952` → 1952; ranges spanning one and two
   centuries, preferred vs alternative, and the unfinished prefix when no in-range year ends that way.
5. Month names, abbreviations, prefixes, ambiguous prefixes and space-confirmed prefixes: `N` →
   `November`, `J` → `June` with ArrowDown → `July` and then `January`, `25 ju` → `25 June …` with July
   next, `N 25`, `Ju 25` (FR-3, FR-9, FR-14, AC-12, AC-23, C26).
6. Character blocking and paste sanitising (FR-2) in the DOM layer, including Tab not inserted or
   treated as a separator (C28, AC-27); unmatched letters → `invalid`.
7. Status vocabulary and feedback text (FR-20, FR-21), including `Date out of range`, ellipsis positions,
   selected-reading marker; highlighted suggestions (FR-30, AC-31).
8. Reading list order and ArrowDown/ArrowUp cycling, cap (FR-15); separator-accepted alternatives and
   current readings (C30, C32, AC-30, AC-32); Enter confirmation matrix (FR-16).
9. `textFormat` rendering for each token and round-trip re-parse, year-first pattern → `TypeError`
   (FR-24); blur commit, blur reset and Esc cancel with and without `defaultValue`, including a complete
   `defaultValue` re-syncing the date input and the `YY` fallback for a non-preferred century
   (FR-24, FR-25, A-3, OQ-5, AC-26, AC-28, AC-30).
10. Page binding: `input`, paste, deletion, completion → date input value, editing back to a non-`complete`
    status → date input cleared (FR-27), picker → reading and text, no write loops, `destroy()` removes
    listeners (FR-1, FR-26 … FR-28).

## 8. Out of scope for this version

- Year-first typed input (`2024-05-25` typed by the user) and year-first `textFormat` patterns, which
  FR-24 rejects (OQ-2, A-4); era/BC, week numbers.
- Locales other than English, free-form text, time of day.
- Reformatting or correcting the value while typing (commit-time conversion is in scope, FR-24).
- Persistence, form serialisation helpers, framework wrappers, a custom picker.

## 9. Traceability to the problem statement

| Statement sentence                                                        | Requirements          |
| ------------------------------------------------------------------------- | --------------------- |
| incrementally parse … by analyzing consecutively entered digit or letter  | FR-1, FR-2, FR-3, FR-7 |
| eliminate possibilities of misinterpreting input                          | FR-11, FR-12, FR-14   |
| middle-endian and little-endian only                                      | FR-12                 |
| short year, derive century                                                | FR-10, FR-13          |
| the same digits read one way and committed to                                    | FR-6, AC-22           |
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
| C1  | "User may use separators such as dot, dash or slash and they indeed should mean segment boundaries"                                          | `.`, `-`, `/` and non-Tab whitespace are hard boundaries: every run after the first is one part and is never split across a neighbour; the first run keeps the cut it was showing (C32). Commas count as boundaries too, and non-Tab whitespace additionally confirms the preceding guess (C22, C28) | FR-4, AC-13                 |
| C2  | "Source example has logical error. It was meant to communicate the idea but happen to be far from perfect"                                    | The worked examples are illustrative only; the year rules (C15, then C17) are normative, the "range" wording is dropped              | FR-10, AC-8                 |
| C3  | "The century should indeed be assumed to be closest to today"                                                                                | Preferred century = closest in-range century to the frozen `'now'`; other in-range centuries stay as alternatives                 | FR-13, FR-14, AC-19         |
| C4  | "Date format in the text field should be converted according to the pattern … ('d-m-YYYY', 'MM-DD-YY' etc.) … during parsing and prediction, the guessed text should be presented as 'dd MMMM YYYY' or 'MMMM, dd YYYY'" | `textFormat` token pattern applied on commit only; prediction always uses `dd MMMM YYYY` / `MMMM, dd YYYY`                        | FR-20, FR-24, AC-17         |
| C5  | "… user can confirm input by pressing 'Enter', moreover when day and month is determined, the component should propose current year by default (if allowed date range permits this)" | Enter confirms; a missing year is filled with today's year when day+month are determined and that year is in range                 | FR-16, FR-17, AC-15, AC-16  |
| C6  | "if reasonably small number of possible readings can be made, allow user to scroll through them by him pressing 'ArrowDown'"                    | Best-first reading list walked with ArrowDown/ArrowUp, capped by `maxReadings`, marking the selected alternative                  | FR-15, FR-20, FR-22, AC-19  |
| C7  | "Will need you to be clarify your question."                                                                                                  | Former OQ-7 re-asked in concrete terms (three options) and answered: no explanation prose in the feedback, detail goes to the structured result | OQ-3, FR-19, FR-22          |
| C8  | "Range bound 'now' means the date at which the web page was instantiated. Should be fairly static value"                                      | `'now'` is resolved once at construction and never re-evaluated; clock injectable for tests                                       | FR-18, AC-20                |
| C9  | "Yes, invalid characters should be blocked."                                                                                                  | Disallowed characters are prevented on input and stripped from pasted text; letters stay allowed for month names                  | FR-2, AC-14                 |
| C10 | "Yes, factory function."                                                                                                                      | Factory over plain DOM, no custom element, no shadow DOM                                                                          | FR-29                       |
| C11 | "If user leaves control without unambigously interpreted values, the value should be set to default, which is 'undefined', unless specified explicity as an option parameter" | Blur commits a reading Enter can confirm; anything else is reset to `defaultValue` (default: cleared) and clears the date input (C27) | FR-25, AC-18, C27          |
| C12 | "It should be assumed that users are not expected to enter `YYYY-MM-DD` format."                                                          | Year-first entry is not expected: it is not parsed, and `textFormat` rejects year-first patterns with a `TypeError` so the field always re-parses | FR-24, A-4, OQ-2            |
| C13 | "Answer to OQ-2: Reset text field and the date input. Whenever the date can not be resolved from user input is should be cleared." (labelled OQ-2, but it answers OQ-4/C11) | Unresolved text resets both fields on blur; a confirmable reading commits instead, and the date input is emptied as soon as the text no longer resolves to exactly one date | FR-25, FR-27, OQ-4, AC-21   |
| C14 | (design review) "partial vs undetermined — yes, that is the semantics I want"; "Arrow down walks partial readings too … but only if partial readings are less than ~8"; "I agree with your proposed test granularity" | `partial` = a preferred presentable reading that is incomplete (alternative partial readings may be walked); `undetermined` = no reading with a determined month to present; **the `undetermined` half is superseded by C25**; ArrowDown walks partial readings within a cap of 8 readings; one test file per §7 group | FR-14, FR-15, FR-21, §7 |
| C15 | (review of the draft) FR-10 said 1- or 3-digit year runs are impossible, which contradicts AC-9/15/16/21 where such a run is an unfinished year | A 1- or 3-digit run is an unfinished year that survives while an in-range completion exists, and unfinished-year text shows the shared prefix — **superseded by C17**, which makes a 1–3 digit run a year number first and leaves the prefix only as the fallback | FR-10, FR-11, FR-20, AC-8, AC-9 |
| C16 | "Component should commit to initial assumption of endianness if it is plausible enough … '1225' should be interpreted 2005-02-12 … the user may have means to interact with interpretation by putting space (' ') and/or by adding zero ('0')"; "White space can be a separator too"; "separators should be allowed to be used interchangeably (space, /, ., -)" | The cut is committed, not enumerated: parts fill left to right in the assumed order, day and month take two digits whenever they are valid, the year takes the remaining digits, and a committed day is never re-split as more digits arrive. Separators and leading zeros are the user's levers (`1 2 25`, `02305`), and every separator — non-Tab whitespace, `.`, `-`, `/`, `,` — is interchangeable (C28) | FR-2, FR-4, FR-6, AC-22 |
| C17 | "it reads initially as a year 2005 but it allows typing further, so it can be 2052 … if one types 95 and we already are trying to interpret year, this should be interpreted as 1995 but if following is 2 '952' it will be then assumed as 1952" | A 1–3 digit year run is a year *number*: it is the tail of the year (`5` is 05, `952` is 0952) and is completed to the nearest in-range century (`5` → 2005, `52` → 2052, `95` → 1995, `952` → 1952, when the range admits those years), which makes the reading complete while still open to more digits. Only a run no in-range year ends with stays an unfinished prefix | FR-10, FR-13, FR-16, FR-20, AC-16, AC-21, AC-22 |
| C18 | (driving principle) "make it an assumption as soon as it is not contradicting several rules" | Make the earliest assumption the entered characters allow, as soon as none of the rules (calendar validity, range, segmentation, endianness) contradicts it; do not wait for more input when one reading is consistent | §1, FR-6, FR-14 |
| C19 | "Dates can be little-endian and middle-endian, never big-endian"; "assumption about little-endian takes precedence over middle-endian" | Only little- and middle-endian readings exist; big-endian/year-first is never produced; little-endian wins strictly per FR-12 | FR-12, OQ-1 |
| C20 | "Incompleteness of the year … should prompt for suggesting the closest to the current century or millenium. So, the 52->2052 and 952->1952 should hold." | A 1–3 digit year run completes to the in-range year closest to the frozen `now`; `52` → 2052 and `952` → 1952 when the range admits those years. The range still removes completions outside it | FR-10, FR-13, AC-24, A-6 |
| C21 | "Unresolved date should clear value, indeed." | Blur commits a reading Enter can confirm; an unresolved text resets to `defaultValue` and clears the date input. The reset value is reparsed, and a complete `defaultValue` re-syncs the date input through FR-27 | FR-25, A-3, AC-18 |
| C22 | "space should also allow completion of proposed system guess … starts typing 'N' … picks up … first is the month November, so the following <space> confirms that" | Space (and non-Tab whitespace) is both a boundary and the confirmation gesture for the run before it: a unique month prefix is completed (`N` + space is November), an ambiguous prefix is not decided, and the text is never rewritten (C28) | FR-2, FR-3, FR-4, FR-6, AC-23, A-7 |
| C23 | "No, let's not override FR11/FR13 and respect range precedence. Date out of range should trigger the response 'date out of range' and should not translate into valid date." | The range stays absolute and is never relaxed to rescue a value; an out-of-range value keeps `date = null`, clears the date input, and its visible feedback is `Date out of range` | FR-19, FR-20, FR-21, FR-27, AC-11, AC-20, AC-24 |
| C24 | "If user starts his input as 05 - it is incomplete date, assumed to be 5th day of some month. If you mean that Day and Month are determined and user continues with 05 that should mean 2005." | A digit run is a year only once the day and month positions are filled; a leading `05` is day 5 with the month missing. In the year position `05` resolves by FR-13 (`05` → 2005, or the closest in-range year) | FR-6, FR-7, FR-10, A-8 |
| C25 | "When user starts input with N the reading (the text should immediately produce 'November'. Also, because ArrowUp, ArrowDown can scroll through suggestions, J shall produce June and user can chose to press ArrowDown to change it to 'July'" | A determined month is presented immediately as a partial reading (`N` → `November`); an ambiguous month prefix produces partial readings ordered by C26, and ArrowDown/Up walks them (`J` → `June`, ArrowDown → `July`). This supersedes C14's rule that several incomplete readings are `undetermined` | FR-3, FR-14, FR-15, FR-20, FR-21, AC-12, AC-23, A-5 |
| C26 | Bare `J` clarification: January, June and July all match; the chosen order is "June, July, January" | A bare `J` lists June, July, January; longer prefixes keep calendar order (`Ja` → January, `Ju` → June/July). January stays reachable as the third reading | FR-9, FR-14, FR-15, AC-23, A-5 |
| C27 | "What if user does not press enter and leaves input? Should it commit? I think yes: once user commits (either by leaving input or pressing Enter), the original input becomes irrelevant and gets replaced with the suggested input. <Esc> will cancell the input." | Enter, picker and blur all commit through the same path, replacing the typed text with a canonical value. Blur uses Enter's current-year proposal when day and month are determined; a reading Enter cannot confirm still resets to `defaultValue`. A `YY` pattern that would re-parse to another century falls back to FR-20 display text for that commit (OQ-5 A). Esc restores the last committed canonical text, or `defaultValue` if none, without firing `onConfirm` | FR-16, FR-17, FR-24, FR-25, OQ-5, AC-18, AC-26, AC-28 |
| C28 | "Additionally, <Tab> is not a separator (an invalid character) and not supoused to get inserted at all, instead it should allow to move away from the input." | Tab is never inserted or treated as a separator; it keeps native focus movement. Only space/non-Tab whitespace separates or confirms. Tabs in pasted text are stripped, not converted to boundaries | FR-2, FR-3, FR-4, AC-14, AC-27 |
| C30 | "When auto suggested alternative is displayed following user's 'ArrowDown' presses, and the next user input is separator, this means user accepted that alternative suggestion and his following input will complement that alternative value instead of the initial." / "No, in that case blur should pick up the alternative suggestion. But 'ArrowDown' should cycle-through the alternatives, meaning once the last option is exhausted the next one proposed will be the one that was there initially." | A separator typed after `ArrowDown` accepts the selected alternative: the selection survives the separator and later insertions, and later input extends that alternative instead of the preferred reading. A short year typed after acceptance stays open until four digits (`January 4, 2001` + `2` → `January 4, 2012`, not June). For an already complete alternative (for example a different century), the separator only keeps it selected so blur or Enter commits it. ArrowDown/ArrowUp still wrap, returning to the initially preferred reading after the last alternative. An ordinary edit not accepted by a separator, and a deletion, reset the selection to the preferred reading | FR-15, FR-16, FR-25, AC-19, AC-30 |
| C31 | "component should produce a string with the suggested date that contains the emphasized matching user input. e.g. if user typed '2 4 52', then string should look like '<em>2</em>&nbsp;<em>4</em>(April)&nbsp;19<em>52</em>.' (if range ends in 2000). Same for letter input: 'ja' -> '<em>Ja</em>nuary'. If user typed month in number, but suggestion is month name, then it should just follow user's original input in brackets. Small letter can be highlighted as capital letter in month name instead of being added as separate letter. Include that output in a separate element's text in the demo." | The structured result exposes `highlighted`: the presented reading with the user's matching digits emphasized, numeric months followed by `(MonthName)`, letter month prefixes emphasized inside the capitalized full name, `&nbsp;` separators and the same ellipsis/comma rules as FR-20. Message statuses have no highlighted date. The demo renders it in a separate element without replacing the accessible feedback | FR-22, FR-30, AC-31 |
| C32 | "When entering 34 component picks up 3 April (which is correct) but then <space> leads to 'Not enough information'. It should proceed to identifying the year. Generally, once user choses separator, that should mean it is agreeing to component's suggestion and component should continue with that assumption." | A separator accepts the run before it as the cut the component was showing, even when no ArrowDown selection was made. The first run keeps its free split (`34` → `3 April …`, `34 ` stays, `34 2` → `3 April 2002`; `255/24` → `25 May 2024`; `312 2024` keeps the middle-endian March 12). Separators still pin every later run, so `25/345` is invalid | FR-4, FR-6, FR-15, AC-13, AC-32 |

## 11. Assumptions and questions

Assumptions (implemented as stated; say so if one is wrong)

- **A-1** `textFormat` tokens are case-insensitive and driven by repeat count, so both `d-m-YYYY` and
  `DD-MM-YY` from C4 work; letters are the only token characters, so `T`/`Z`-style literals are rejected.
- **A-2** "Reasonably small number of readings" is a cap (default 8, per C14) covering complete and
  partial readings alike; above it ArrowDown keeps its native effect and the list is still exposed
  programmatically (truncated to the cap, best first).
- **A-5** `ambiguous` is reserved for several *complete* dates: a letter run resolving to several months
  is `partial` while the day or year is still missing, with the preferred month presented and the others
  walked by ArrowDown in the C26 order (`J` → June, ArrowDown → July, then January; `25 ju` → `25 June …`,
  AC-12, AC-23), and becomes `ambiguous` once a year makes those readings complete.
- **A-3** `defaultValue` is written verbatim into the text field on a blur reset or an Esc with nothing
  committed (normally the empty string) and then reparsed like any other value; if it is a complete
  date, the date input is filled from it per FR-27, otherwise the date input stays empty.
- **A-4** Users are not expected to enter a year-first date, so no year-first entry is parsed and no
  year-first `textFormat` is offered; whatever the field holds re-parses to the reading shown (C12, OQ-2).
- **A-6** The short-year examples `52` → 2052 and `952` → 1952 assume a range that admits those years
  (an unbounded range, or a `to` bound after 2052). A range ending at a frozen `'now'` in 2026 cannot
  produce 2052; the completion closest to `'now'` is chosen only among the centuries the range leaves
  (FR-13), and if none is left the value is out-of-range (C20).
- **A-7** Non-Tab whitespace confirms only the run it terminates. It does not invent digits for missing parts
  and does not choose between several month matches; those remain readings for further typing (C22).
- **A-8** A run is a year only in the year position; a value starting `05` is day 5 (C24). In the year
  position a two-digit run re-parses by FR-13: `05` is 2005 when the range admits it, and 1905 when the
  range is e.g. `1800-01-01 … 1990-01-01`, because 1905 is then the closest in-range completion. The
  `YY` token itself carries no century.

Questions — answered ones are kept here so the FR references stay stable

| id   | question                                                                                                                                                                                                                                    | decision                                                                                                  | status   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------- |
| OQ-1 | Is the little-endian preference really absolute? Applying FR-12 strictly means `52` shows `5 February …` and the middle-endian reading of the same digits never wins while a day-first one survives. Or should middle-endian come back whenever its reading is *more* plausible? | Keep it absolute: preference is not a plausibility vote (the statement says "prefer", and C2 distrusts the examples). With C16/C17, `1225` is cut day-first as 12\|2\|5 → 12 February 2005 | decided  |
| OQ-2 | `textFormat` with a year-first pattern such as `YYYY-MM-DD` writes a value the parser cannot read back (year-first input is out of scope). Support year-first patterns (and year-first parsing of committed values), or reject such patterns? | Reject; no year-first entry is expected (A-4), a year-first pattern would break FR-17, so `TypeError` at construction | decided  |
| OQ-3 | (C7 return) What should the feedback explain besides the date? Option A: just the reading and status (`25 May …`). Option B: also why alternatives were dropped (`02-05 dropped: a 1-digit year is impossible`). Option C: B, but only on request (a details element / debug flag). | **A** — reading and status only; the structured result (FR-22) carries the detail, and the live region stays quiet | decided  |
| OQ-4 | C11's "default" — is it the text field's value (reset to `defaultValue` string, as specified in FR-25) or only the component's resolved date (text left as typed)?                                                                          | Reset both when blur resets an unresolved value: the text field to `defaultValue` and the date input cleared. C27 later makes a confirmable value commit instead of resetting | decided  |
| OQ-5 | A `YY` token always sits in the year position, so the written value re-parses by FR-13 (C24, A-8): with `MM-DD-YY`, `05-05-05` re-parses as 5 May 2005 when that year is preferred, or as the closest in-range year otherwise. That is correct while the confirmed date is that preferred year. But AC-19 lets the user select a non-preferred century (1905 under `1900-01-01 … now`); writing `05-05-05` would re-parse as 2005, so the text would no longer describe the confirmed 1905. What should commit do in that case? (A) fall back to the four-digit year or FR-20 display text for that commit; (B) write the `YY` pattern anyway and accept that the text re-parses to the preferred century; (C) reject `YY` patterns at construction, or reject confirmation of a non-preferred century when `YY` is configured; (D) something else. | **A** — render the pattern and re-parse it; if it does not describe the confirmed date, use FR-20 display text for that commit instead. Parsing a `YY` value remains governed by C24/A-8 (C27, FR-24, AC-28) | decided  |
