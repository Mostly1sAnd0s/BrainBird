import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createScoreStore, validateEntry } from './scores.js';

function tmpFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bb-')), 'scores.json');
}

test('validateEntry accepts sane input', () => {
  const e = validateEntry({ name: 'Neuron 9', score: 12, source: 'eeg' });
  assert.equal(e.name, 'Neuron 9');
  assert.equal(e.score, 12);
  assert.equal(e.source, 'eeg');
});

test('validateEntry trims and caps name length', () => {
  const e = validateEntry({ name: '  ' + 'x'.repeat(50) + '  ', score: 1 });
  assert.equal(e.name.length, 16);
});

test('validateEntry rejects junk', () => {
  assert.throws(() => validateEntry({ name: '', score: 5 }), /name/);
  assert.throws(() => validateEntry({ name: 'x', score: -1 }), /score/);
  assert.throws(() => validateEntry({ name: 'x', score: 3.5 }), /score/);
  assert.throws(() => validateEntry({ name: 'x', score: 1e9 }), /score/);
  assert.throws(() => validateEntry({ name: 'x', score: 1, source: 'cheat' }), /source/);
});

test('empty store returns empty leaderboard', () => {
  const store = createScoreStore(tmpFile());
  assert.deepEqual(store.top(), []);
});

test('submit inserts sorted, keeps max 10', () => {
  const store = createScoreStore(tmpFile());
  for (const s of [5, 40, 12, 99, 3, 60, 7, 22, 8, 31, 2]) {
    store.submit({ name: 'P' + s, score: s });
  }
  const top = store.top();
  assert.equal(top.length, 10);
  const scores = top.map((e) => e.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  assert.equal(top[0].score, 99);
  assert.ok(!scores.includes(2), 'lowest score evicted');
});

test('submit reports rank of the new entry', () => {
  const store = createScoreStore(tmpFile());
  assert.equal(store.submit({ name: 'a', score: 10 }).rank, 1);
  assert.equal(store.submit({ name: 'b', score: 5 }).rank, 2);
  assert.equal(store.submit({ name: 'c', score: 1 }).rank, 3);
  for (let i = 1; i <= 9; i++) store.submit({ name: 'q', score: 100 + i });
  assert.equal(store.submit({ name: 'd', score: 0 }).rank, null, 'off the board');
});

test('persists across reload', () => {
  const file = tmpFile();
  createScoreStore(file).submit({ name: 'ghost', score: 7, source: 'keyboard' });
  const reloaded = createScoreStore(file);
  assert.equal(reloaded.top()[0].name, 'ghost');
  assert.equal(reloaded.top()[0].source, 'keyboard');
});

test('tolerates corrupt storage file', () => {
  const file = tmpFile();
  fs.writeFileSync(file, '{not json');
  const store = createScoreStore(file);
  assert.deepEqual(store.top(), []);
  store.submit({ name: 'ok', score: 1 });
  assert.equal(store.top().length, 1);
});
