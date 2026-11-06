// Reading → display text (FR-19, FR-20), `textFormat` handling (FR-24) and
// the selected reading of a result (FR-15, FR-16).

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const MONTH_ABBREVIATIONS = MONTH_NAMES.map((name) => name.slice(0, 3));

export const NOT_ENOUGH = 'Not enough information';

const ELLIPSIS = '…';
const MESSAGE_STATUSES = new Set(['undetermined', 'invalid', 'out-of-range']);

/** Prediction always reads `dd MMMM YYYY` / `MMMM, dd YYYY` (FR-20, C4). */
export function formatReading(reading) {
  const dayText = reading.day === null ? ELLIPSIS : String(reading.day);
  const monthText = reading.month === null ? ELLIPSIS : MONTH_NAMES[reading.month - 1];
  const yearText =
    reading.year !== null
      ? String(reading.year)
      : reading.yearPrefix
        ? `${reading.yearPrefix}${ELLIPSIS}`
        : ELLIPSIS;

  if (reading.endianness === 'middle') {
    return reading.year === null && !reading.yearPrefix
      ? `${monthText} ${dayText} ${yearText}`
      : `${monthText} ${dayText}, ${yearText}`;
  }
  return `${dayText} ${monthText} ${yearText}`;
}

const TOKEN_LENGTHS = { d: [1, 2], m: [1, 4], y: [2, 4] };
const PATTERN_SEPARATORS = new Set([' ', '\t', '\n', '.', '-', '/', ',']);
const LETTER = /[A-Za-z]/;

/**
 * Validates a `textFormat` pattern once, at construction (FR-24).
 * Year-first patterns are rejected outright: the value they write cannot be
 * read back (A-4, C12), and users are not expected to type that form.
 */
export function compilePattern(pattern) {
  if (typeof pattern !== 'string' || pattern.length === 0) {
    throw new TypeError('textFormat must be a non-empty string');
  }

  const tokens = [];
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    const letter = character.toLowerCase();

    if (LETTER.test(character) && TOKEN_LENGTHS[letter]) {
      let end = index;
      while (end < pattern.length && pattern[end].toLowerCase() === letter) end += 1;
      const text = pattern.slice(index, end);
      const [shortest, longest] = TOKEN_LENGTHS[letter];
      if (text.length < shortest || text.length > longest) {
        throw new TypeError(`Unsupported textFormat token "${text}"`);
      }
      tokens.push({ type: 'part', part: letter, length: text.length });
      index = end - 1;
      continue;
    }

    if (PATTERN_SEPARATORS.has(character)) {
      tokens.push({ type: 'literal', text: character });
      continue;
    }

    throw new TypeError(`Unsupported textFormat character "${character}"`);
  }

  if (tokens[0].type === 'part' && tokens[0].part === 'y') {
    throw new TypeError('Year-first textFormat patterns are not supported');
  }

  return tokens;
}

function renderToken(token, date) {
  const { part, length } = token;
  if (part === 'd') {
    return length === 1 ? String(date.day) : String(date.day).padStart(2, '0');
  }
  if (part === 'm') {
    if (length === 1) return String(date.month);
    if (length === 2) return String(date.month).padStart(2, '0');
    if (length === 3) return MONTH_ABBREVIATIONS[date.month - 1];
    return MONTH_NAMES[date.month - 1];
  }
  return length === 2 ? String(date.year % 100).padStart(2, '0') : String(date.year).padStart(4, '0');
}

export function renderPattern(tokens, date) {
  return tokens
    .map((token) => (token.type === 'literal' ? token.text : renderToken(token, date)))
    .join('');
}

export function formatWithPattern(pattern, date) {
  return renderPattern(compilePattern(pattern), date);
}

/**
 * Returns `result` with reading `index` selected (FR-15, FR-16, FR-20).
 * For a message status the first entry still shows the message, so parking
 * on "Not enough information" and pressing ArrowDown reads naturally.
 */
export function selectReading(result, index) {
  const readings = result.readings || [];
  if (readings.length === 0) {
    return {
      ...result,
      index: -1,
      readings,
      text: result.text || '',
      date: null,
      endianness: null,
      parts: null,
      spans: null,
    };
  }

  const requested = Number.isInteger(index) ? index : 0;
  const selected = Math.min(Math.max(requested, 0), readings.length - 1);
  const reading = readings[selected];
  const marker = selected > 0 ? ` (${selected + 1} of ${readings.length})` : '';
  const isMessage = MESSAGE_STATUSES.has(result.status);

  return {
    ...result,
    index: selected,
    text: isMessage && selected === 0 ? NOT_ENOUGH : `${formatReading(reading)}${marker}`,
    date: reading.complete ? reading.iso : null,
    endianness: reading.endianness,
    parts: { day: reading.day, month: reading.month, year: reading.year },
    spans: reading.spans,
  };
}
