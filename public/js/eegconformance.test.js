// Conformance: every line format the reference Arduino sketch can emit must
// survive the splitter + parser unchanged. If the sketch's printf format ever
// drifts from what parseLine accepts, this test fails.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLine, createLineSplitter } from './eeg.js';

// Mirror of the sketch's Serial.printf output: C %.2f and %d, Serial.println => \r\n.
function sketchFlapLine(conf) { return `F:${conf.toFixed(2)}\r\n`; }
function sketchStrengthLine(v) { return `S:${Math.round(v)}\r\n`; }

test('flap lines from the sketch format parse at full confidence range', () => {
  for (const conf of [0.5, 0.63, 0.87, 1.0]) {
    const ev = parseLine(sketchFlapLine(conf));
    assert.equal(ev.type, 'flap');
    assert.ok(Math.abs(ev.confidence - conf) < 1e-9);
  }
});

test('strength lines parse across the 10-bit ADC range', () => {
  for (const v of [0, 1, 511, 512, 1023, 1024]) {
    const ev = parseLine(sketchStrengthLine(v));
    assert.equal(ev.type, 'strength');
    assert.equal(ev.value, v);
  }
});

test('a realistic interleaved sketch stream parses end to end', () => {
  // what the device actually sends: S at ~10 Hz, occasional F, byte-chunked by USB
  const raw = [
    sketchStrengthLine(503), sketchStrengthLine(511), sketchFlapLine(0.92),
    sketchStrengthLine(517), sketchStrengthLine(498),
  ].join('');
  const split = createLineSplitter();
  const events = [];
  // chop into ragged 7-byte chunks like the real USB serial reader delivers
  for (let i = 0; i < raw.length; i += 7) {
    for (const line of split.push(raw.slice(i, i + 7))) {
      const ev = parseLine(line);
      if (ev) events.push(ev);
    }
  }
  assert.deepEqual(events.map((e) => e.type), ['strength', 'strength', 'flap', 'strength', 'strength']);
  assert.equal(events[2].confidence, 0.92);
});

test('sketch startup banner lines are ignored, not errors', () => {
  for (const banner of ['BrainBird EEG v1 starting...', 'calibrating baseline (3s)']) {
    assert.equal(parseLine(banner), null);
  }
});
