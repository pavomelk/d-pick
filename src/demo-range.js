// Demo-only helper for the allowed-range field. The component's `range`
// option is an object; this module turns the free-text field into that object
// and back without validating dates (FR-18/FR-31).

export function parseRangeInput(text) {
  const value = String(text ?? '').trim();
  if (!value) return {};

  if (value.startsWith('{') || value.startsWith('[')) {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new TypeError('Range must be an object');
    }
    return parsed;
  }

  const separator = value.indexOf('..');
  if (separator === -1) return { from: value };

  const from = value.slice(0, separator).trim();
  const to = value.slice(separator + 2).trim();
  const range = {};
  if (from) range.from = from;
  if (to) range.to = to;
  return range;
}

export function formatRangeInput(range = {}) {
  const from = range.from == null ? '' : String(range.from);
  const to = range.to == null ? '' : String(range.to);
  return to ? `${from}..${to}` : from;
}
