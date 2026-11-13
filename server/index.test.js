import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createApp } from './index.js';
import { createScoreStore } from './scores.js';

function tmpFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bb-')), 'scores.json');
}

async function withServer(fn) {
  const app = createApp({ scoreFile: tmpFile(), publicDir: 'public' });
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); } finally { server.close(); }
}

test('serves the game page', () => withServer(async (base) => {
  const res = await fetch(base + '/');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /BrainBird/);
  assert.match(html, /<canvas/i);
}));

test('GET /api/scores returns the board', () => withServer(async (base) => {
  const res = await fetch(base + '/api/scores');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { scores: [] });
}));

test('POST /api/scores stores a run and returns rank', () => withServer(async (base) => {
  const res = await fetch(base + '/api/scores', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Braino', score: 33, source: 'eeg' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.rank, 1);
  assert.equal(body.board[0].name, 'Braino');
  const check = await (await fetch(base + '/api/scores')).json();
  assert.equal(check.scores.length, 1);
}));

test('POST /api/scores rejects junk with 400', () => withServer(async (base) => {
  for (const bad of [{}, { name: 'x' }, { name: 'x', score: -5 }, { name: 'x', score: 1, source: 'hax' }]) {
    const res = await fetch(base + '/api/scores', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(bad),
    });
    assert.equal(res.status, 400, `should reject ${JSON.stringify(bad)}`);
  }
}));

test('POST rejects oversized body (no memory abuse)', () => withServer(async (base) => {
  const res = await fetch(base + '/api/scores', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'x'.repeat(100000), score: 1 }),
  });
  assert.ok(res.status === 400 || res.status === 413);
}));

test('unknown API route is 404 JSON, not HTML fallback', () => withServer(async (base) => {
  const res = await fetch(base + '/api/nope');
  assert.equal(res.status, 404);
  assert.match(res.headers.get('content-type'), /json/);
}));
