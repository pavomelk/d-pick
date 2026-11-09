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

### Example 1: Month-First Input

A leading `5` is enough to assume the month-first interpretation: the user is entering month 5 (May). Each row shows the next character typed and the value entered so far.

| Next character | Value so far | Feedback |
| --- | --- | --- |
| `5` | `5` | May — month 5 is assumed as the first part |
| `2` | `52` | May 2 … |
| `5` | `525` | May 25 … |
| `2` | `5252` | May 25, 2002 — year 52 resolves within the allowed range |
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
