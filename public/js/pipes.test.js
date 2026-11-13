import test from 'node:test';
import assert from 'node:assert/strict';
import { difficultyFor, spawnPipe, PIPE_W } from './pipes.js';
import { mulberry32 } from './rng.js';
import { WORLD_H, WORLD_W } from './game.js';

test('difficulty ramps gap down and speed up with score', () => {
  const easy = difficultyFor(0);
  const hard = difficultyFor(60);
  assert.ok(hard.gap < easy.gap);
  assert.ok(hard.speed > easy.speed);
  assert.ok(hard.gap >= 100, 'gap never gets unfair');
  assert.ok(hard.speed <= 6);
});

test('moving pipes only appear at higher scores', () => {
  const rng = mulberry32(7);
  for (let i = 0; i < 200; i++) assert.equal(difficultyFor(10, rng).moving, false);
  let sawMoving = false;
  for (let i = 0; i < 200; i++) if (difficultyFor(40, rng).moving) sawMoving = true;
  assert.ok(sawMoving);
});

test('spawned pipes keep the gap inside the world', () => {
  const rng = mulberry32(3);
  for (let s = 0; s < 80; s += 3) {
    const p = spawnPipe(WORLD_W + 10, s, rng);
    assert.ok(p.gapY - p.gap / 2 >= 30, 'gap not buried in the sky');
    assert.ok(p.gapY + p.gap / 2 <= WORLD_H - 30, 'gap not buried in the floor');
    assert.equal(p.scored, false);
    assert.equal(p.x, WORLD_W + 10);
    assert.equal(p.w, PIPE_W);
  }
});

test('spawn spacing jitters around the difficulty interval', () => {
  const rng = mulberry32(9);
  const gaps = [];
  for (let i = 0; i < 100; i++) gaps.push(spawnPipe(0, 20, rng).nextSpawnIn);
  const d = difficultyFor(20);
  const unique = new Set(gaps.map((g) => g.toFixed(1))).size;
  assert.ok(unique > 1, 'spacing varies');
  assert.ok(gaps.every((g) => g >= d.spawnDist * 0.85 && g <= d.spawnDist * 1.15));
});
