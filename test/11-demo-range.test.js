// §7 group 11 — the demo's allowed-range field (FR-31).

import test from 'node:test';
import assert from 'node:assert/strict';

import { formatRangeInput, parseRangeInput } from '../src/demo-range.js';

test('FR-31: a range field accepts from..to and keeps the bounds as typed', () => {
  assert.deepEqual(parseRangeInput('1972-02-05..now'), {
    from: '1972-02-05',
    to: 'now',
  });
  assert.deepEqual(parseRangeInput(' 1972-02-05 .. now '), {
    from: '1972-02-05',
    to: 'now',
  });
  assert.deepEqual(parseRangeInput('1972-02-05..'), { from: '1972-02-05' });
  assert.deepEqual(parseRangeInput('..now'), { to: 'now' });
  assert.deepEqual(parseRangeInput('1972-02-05'), { from: '1972-02-05' });
  assert.deepEqual(parseRangeInput(''), {});
  assert.deepEqual(parseRangeInput('   '), {});
});

test('FR-31: a range field also accepts a JSON range option', () => {
  assert.deepEqual(parseRangeInput('{ "from": "1972-02-05", "to": "now" }'), {
    from: '1972-02-05',
    to: 'now',
  });
  assert.throws(() => parseRangeInput('{'), SyntaxError);
  assert.throws(() => parseRangeInput('[]'), TypeError);
});

test('FR-31: a range option formats back into the field', () => {
  assert.equal(formatRangeInput({ from: '1972-02-05', to: 'now' }), '1972-02-05..now');
  assert.equal(formatRangeInput({ from: '1972-02-05' }), '1972-02-05');
  assert.equal(formatRangeInput({ to: 'now' }), '..now');
  assert.equal(formatRangeInput({}), '');
});
