import test from 'node:test';
import assert from 'node:assert/strict';
import { GRAVITY, FLAP_IMPULSE, WORLD_W, WORLD_H, createWorld, flap, stepWorld, circleRect } from './game.js';

test('world starts alive with bird at rest', () => {
  const w = createWorld();
  assert.equal(w.alive, true);
  assert.equal(w.score, 0);
  assert.equal(w.bird.y, WORLD_H * 0.45);
  assert.equal(w.bird.vy, 0);
});

test('gravity pulls the bird down over time', () => {
  const w = createWorld();
  stepWorld(w, 1 / 60);
  assert.ok(w.bird.vy > 0, 'velocity increases downward');
  const y1 = w.bird.y;
  stepWorld(w, 1 / 60);
  assert.ok(w.bird.y > y1);
});

test('flap sets upward impulse', () => {
  const w = createWorld();
  flap(w);
  assert.equal(w.bird.vy, FLAP_IMPULSE);
  assert.ok(FLAP_IMPULSE < 0);
  assert.ok(GRAVITY > 0);
});

test('bird is bounded at the top, dies on the floor', () => {
  const w = createWorld();
  for (let i = 0; i < 120; i++) { flap(w); stepWorld(w, 1 / 60); }
  assert.ok(w.bird.y >= 0, 'never above the sky');
  const w2 = createWorld({ pipes: [] });
  for (let i = 0; i < 400 && w2.alive; i++) stepWorld(w2, 1 / 60);
  assert.equal(w2.alive, false);
});

test('circleRect detects hits and misses', () => {
  const rect = { x: 100, y: 0, w: 40, h: 200 };
  assert.equal(circleRect(110, 100, 10, rect), true);
  assert.equal(circleRect(50, 100, 10, rect), false);
  assert.equal(circleRect(120, 215, 10, rect), false, '5 px clear of the bottom edge');
  assert.equal(circleRect(120, 204, 10, rect), true, 'overlaps the bottom edge by 6 px');
  assert.equal(circleRect(146, 203, 10, rect), true, 'corner distance check');
  assert.equal(circleRect(150, 206, 10, rect), false, 'past the corner');
});

test('score increments once per pipe fully passed', () => {
  const w = createWorld({ pipes: [] });
  w.pipes.push({ x: 60, w: 52, gapY: WORLD_H / 2, gap: 200, scored: false, drift: 0 });
  let scoredEvents = 0;
  while (w.alive) { const ev = stepWorld(w, 1 / 60); if (ev.scored) scoredEvents++; }
  assert.equal(scoredEvents, 1);
  assert.equal(w.score, 1);
});

test('collision with a pipe kills the bird', () => {
  const w = createWorld({ pipes: [] });
  w.pipes.push({ x: 200, w: 52, gapY: WORLD_H / 2, gap: 100, scored: false, drift: 0 });
  w.bird.x = 200; // straight into the lower pipe body; bird sits below gap center
  w.bird.y = WORLD_H / 2 + 90;
  const ev = stepWorld(w, 1 / 60);
  assert.equal(ev.dead, true);
  assert.equal(w.alive, false);
});

test('stepWorld is deterministic given the same rng seed', () => {
  const a = createWorld({ seed: 42, pipes: [] });
  const b = createWorld({ seed: 42, pipes: [] });
  for (let i = 0; i < 600; i++) { stepWorld(a, 1 / 60); stepWorld(b, 1 / 60); }
  assert.deepEqual(a.pipes.map((p) => [Math.round(p.x), Math.round(p.gapY)]),
                   b.pipes.map((p) => [Math.round(p.x), Math.round(p.gapY)]));
  assert.equal(a.alive, b.alive);
});

test('world scrolls at world speed and pipes recycle off-screen', () => {
  const w = createWorld({ seed: 1, pipes: [] });
  for (let i = 0; i < 60; i++) stepWorld(w, 1 / 60);
  assert.ok(w.t > 0);
  assert.ok(w.pipes.every((p) => p.x + 52 > 0), 'offscreen pipes removed');
});
