// Value → segments (FR-2, FR-4).
//
// A segment is a maximal run of digits or of letters. Separators — `.`, `-`,
// `/`, `,` and non-Tab whitespace — end a segment, and so does every digit↔letter
// transition. Separators close the run they follow; the first run keeps the
// cut it was showing, while later runs are pinned to one part (FR-4, C32).
// Tab is a navigation key, not content (C28).

const DIGIT = /[0-9]/;
const LETTER = /[A-Za-z]/;
const SEPARATORS = new Set([' ', '\n', '\r', '\f', '\v', '.', '-', '/', ',']);

export function scan(rawValue) {
  const value = rawValue == null ? '' : String(rawValue);
  const segments = [];
  let current = null;
  let hasSeparator = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    let kind;

    if (DIGIT.test(character)) kind = 'digit';
    else if (LETTER.test(character)) kind = 'letter';
    else if (SEPARATORS.has(character)) {
      hasSeparator = true;
      current = null;
      continue;
    } else {
      // A character the field never accepts (FR-2): no reading can exist.
      return { value, ok: false, empty: false, segments: [], hasSeparator };
    }

    if (!current || current.kind !== kind) {
      current = { kind, text: '', start: index, end: index };
      segments.push(current);
    }
    current.text += character;
    current.end = index + 1;
  }

  const empty = segments.length === 0;
  return { value, ok: true, empty, segments, hasSeparator };
}
