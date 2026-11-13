import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLine, createLineSplitter, createDebouncer, createConfidenceGate } from './eeg.js';

test('parseLine handles flap and strength lines', () => {
  assert.deepEqual(parseLine('F:0.9'), { type: 'flap', confidence: 0.9 });
  assert.deepEqual(parseLine('S:512'), { type: 'strength', value: 512 });
  assert.deepEqual(parseLine(' F:1 '), { type: 'flap', confidence: 1 });
});

test('parseLine rejects garbage without throwing', () => {
  assert.equal(parseLine(''), null);
  assert.equal(parseLine('hello'), null);
  assert.equal(parseLine('F:notanumber'), null);
  assert.equal(parseLine('X:1'), null);
});

test('line splitter reassembles partial serial chunks', () => {
  const split = createLineSplitter();
  // a trailing lone \r is held back: it may be the start of \r\n
  assert.deepEqual(split.push('F:0.5\r\nS:1\r'), ['F:0.5']);
  assert.deepEqual(split.push('2\nF:0.7'), ['S:1', '2']); // \r resolved as a terminator; F:0.7 unterminated
  assert.deepEqual(split.flush(), ['F:0.7']);
});

test('line splitter flush returns the unterminated tail', () => {
  const split = createLineSplitter();
  split.push('F:0.5\nS:9');
  assert.deepEqual(split.flush(), ['S:9']);
  assert.deepEqual(split.flush(), []);
});

test('confidence gate blocks flaps below the user threshold', () => {
  let threshold = 0.7;
  const gate = createConfidenceGate(() => threshold);
  assert.equal(gate(0.69), false);
  assert.equal(gate(0.7), true, 'exactly at threshold passes');
  assert.equal(gate(0.95), true);
  threshold = 0.9; // user moves the slider mid-game
  assert.equal(gate(0.8), false, 'new threshold applies immediately');
});

test('debouncer blocks flaps closer than the window', () => {
  const ok = createDebouncer(250);
  assert.equal(ok(0), true, 'first flap allowed');
  assert.equal(ok(100), false);
  assert.equal(ok(249), false);
  assert.equal(ok(250), true);
  assert.equal(ok(400), false, 'window restarts from the accepted flap');
  assert.equal(ok(500), true);
});
