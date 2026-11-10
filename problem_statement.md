# Incremental Date Parser — Problem Statement

## Goal

The component incrementally parses user input to predict a date. It analyzes digits and letters as they are entered and eliminates interpretations that become impossible.

## Requirements

- Support middle-endian and little-endian dates only.
- Recognize when a year is entered with two digits and derive its century.
- Let the application specify the date range in which the component should operate (for example, from 20 September 1995 to today), and use that range to rule out dates outside it.
- Use an `<input type="text">` element while complementing an existing `<input type="date">`, so the native date picker remains usable alongside the text input.
- Provide visual feedback about the current interpretation on every text change in the text input.
- Use month names in the interpretation.
- Prefer little-endian interpretation over middle-endian.

## Date Range

The lower and upper bounds may each be left undefined or set to `'now'`, meaning the current date. The upper bound cannot be earlier than the lower bound.

## Example Behaviour

For the examples below, the date range is `('1972-02-05', 'now')`.

### Example 1: Input That Eventually Resolves Month-First

The first digit does not choose the interpretation by itself. Day-first is preferred until it can no longer explain the input; then the remaining month-first reading wins. Each row shows the next character typed and the value entered so far.

| Next character | Value so far | Feedback |
| --- | --- | --- |
| `5` | `5` | Not enough information — day 5 with the month still missing |
| `2` | `52` | 5 February … — day 5 is committed, so month 2 follows |
| `5` | `525` | 5 February 2005 — day 5, month 2, year 5 resolves to 2005 |
| `2` | `5252` | May 25, 2002 — day-first would need year 52, which is outside the allowed range |
| `4` | `52524` | May 25, 2024 — parsing complete, date identified |

### Example 2: Day-First Input

Alternatively, the same kind of input can be read day-first.

| Next character | Value so far | Feedback |
| --- | --- | --- |
| `2` | `2` | Not enough information |
| `5` | `25` | Not enough information |
| `5` | `255` | Cannot be 02-05 because the following `5` cannot fall into the permitted year range, so it must be 25 May... |
| `2` | `2552` | 25 May 20... |
| `4` | `25524` | 25 May 2024 — parsing complete |
