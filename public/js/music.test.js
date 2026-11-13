import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSong, SECTIONS, LOOP_BARS, BPM, midiToFreq } from './music.js';

const KINDS = new Set(['bass', 'arp', 'lead', 'hat', 'snare']);

test('buildSong is deterministic per seed', () => {
  const a = buildSong(42);
  const b = buildSong(42);
  assert.deepEqual(a.events, b.events);
  const c = buildSong(43);
  assert.notDeepEqual(a.events, c.events, 'different seeds arrange differently');
});

test('loop is long: 4 sections x 8 bars, audible tempo', () => {
  const s = buildSong(1);
  assert.equal(s.sections.length, SECTIONS.length);
  assert.equal(s.loopBars, LOOP_BARS);
  assert.equal(LOOP_BARS, 32); // 4 x 8-bar sections
  assert.ok(BPM >= 90 && BPM <= 140);
  assert.equal(s.loopBeats, LOOP_BARS * 4);
});

test('events are time-ordered, non-negative, and end within the loop', () => {
  const s = buildSong(7);
  assert.ok(s.events.length > 300, `expected a dense arrangement, got ${s.events.length}`);
  let prev = -1;
  for (const e of s.events) {
    assert.ok(e.t >= prev, 't must be monotonic');
    assert.ok(e.t >= 0);
    assert.ok(e.t + e.dur <= s.loopBeats + 1e-9, 'nothing spills past the loop');
    prev = e.t;
  }
});

test('every event is an audible, sane note or drum', () => {
  const s = buildSong(3);
  for (const e of s.events) {
    assert.ok(KINDS.has(e.kind), `unknown kind ${e.kind}`);
    if (e.kind === 'hat' || e.kind === 'snare') continue;
    assert.ok(Number.isFinite(e.freq));
    assert.ok(e.freq > 50 && e.freq < 4000, `freq ${e.freq} out of range`);
    assert.ok(e.gain > 0 && e.gain <= 0.5, `gain ${e.gain} out of mix bounds`);
  }
});

test('every bar has a bass foundation', () => {
  const s = buildSong(5);
  for (let bar = 0; bar < LOOP_BARS; bar++) {
    const has = s.events.some((e) => e.kind === 'bass' && e.t >= bar * 4 && e.t < (bar + 1) * 4);
    assert.ok(has, `bar ${bar} has no bass`);
  }
});

test('lead melody exists and arrives after the intro breathes', () => {
  const s = buildSong(9);
  const leads = s.events.filter((e) => e.kind === 'lead');
  assert.ok(leads.length > 12, 'song needs a real melody line');
  const firstLeadBar = Math.floor(leads[0].t / 4);
  assert.ok(firstLeadBar >= 4, 'intro bars without lead for build-up');
});

test('harmony walks a progression, not one frozen chord', () => {
  const s = buildSong(11);
  const bassPitches = new Set(s.events.filter((e) => e.kind === 'bass').map((e) => Math.round(e.freq)));
  assert.ok(bassPitches.size >= 3, 'at least 3 distinct roots across the loop');
});

test('midiToFreq anchors A4=440', () => {
  assert.ok(Math.abs(midiToFreq(69) - 440) < 1e-9);
  assert.ok(Math.abs(midiToFreq(57) - 220) < 1e-9);
});
