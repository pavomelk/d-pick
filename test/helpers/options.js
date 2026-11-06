// Shared fixtures for the parser tests.
//
// The base scenario of requirements.md §5: range 1972-02-05 … now, page
// instantiated on 2026-11-04, so the frozen `to` is 2026-11-04.

export const NOW = '2026-11-04';

export const BASE_RANGE = Object.freeze({ from: '1972-02-05', to: 'now' });

/** Parse options for the base scenario, with optional overrides. */
export function base(overrides = {}) {
  return { range: BASE_RANGE, now: NOW, ...overrides };
}
