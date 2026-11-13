// Core game world: physics, scoring, collision. Pure and deterministic — no DOM,
// no canvas. The renderer reads this state; the loop drives it with fixed dt.
import { mulberry32 } from './rng.js';
import { spawnPipe, difficultyFor } from './pipes.js';

export const WORLD_W = 960;
export const WORLD_H = 540;
export const GRAVITY = 0.35; // px/frame^2 at 60 Hz (default)
export const GRAVITY_MIN = 0.12; // floaty: eeg-friendly
export const GRAVITY_MAX = 0.6; // heavy: arcade-snappy

// Clamp user-supplied gravity (from the settings slider) into the safe band.
// Non-numeric junk (corrupt localStorage) falls back to the default.
export function clampGravity(g) {
  const n = Number(g);
  if (!Number.isFinite(n)) return GRAVITY;
  return Math.min(GRAVITY_MAX, Math.max(GRAVITY_MIN, n));
}
export const FLAP_IMPULSE = -6.2; // px/frame
export const BIRD_X = WORLD_W * 0.28;
export const BIRD_R = 13;
export const HITBOX_SHRINK = 4; // forgiving collisions

export function createWorld({ seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0, pipes = null, gravity = GRAVITY } = {}) {
  return {
    seed,
    gravity: clampGravity(gravity),
    rng: mulberry32(seed),
    t: 0, // elapsed frames (60 Hz units), drives pipe drift sine
    score: 0,
    alive: true,
    bird: { x: BIRD_X, y: WORLD_H * 0.45, vy: 0, rot: 0 },
    pipes: pipes === null ? [spawnPipe(WORLD_W + 80, 0, mulberry32(seed ^ 0xbeef))] : pipes,
    distToNextSpawn: 260, // px of scroll before the next pipe appears
  };
}

export function flap(w) {
  if (!w.alive) return;
  w.bird.vy = FLAP_IMPULSE;
}

export function circleRect(cx, cy, r, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

// Advance the world by dt seconds (converted to 60 Hz frame units).
// Returns events: { scored, dead } booleans for the caller to react to.
export function stepWorld(w, dt) {
  const ev = { scored: false, dead: false };
  if (!w.alive) return ev;
  const dtf = dt * 60;
  w.t += dtf;

  const speed = difficultyFor(w.score).speed; // pure: no rng per frame

  // bird physics
  const b = w.bird;
  b.vy += w.gravity * dtf;
  b.y += b.vy * dtf;
  if (b.y < 0) { b.y = 0; b.vy = Math.max(b.vy, 0); } // sky clamps, floor kills
  b.rot = Math.max(-0.5, Math.min(1.2, b.vy / 10));

  // scroll + spawn pipes
  w.distToNextSpawn -= speed * dtf;
  if (w.distToNextSpawn <= 0) {
    const p = spawnPipe(WORLD_W + 40, w.score, w.rng);
    w.pipes.push(p);
    w.distToNextSpawn = p.nextSpawnIn;
  }
  for (const p of w.pipes) {
    p.x -= speed * dtf;
    if (p.drift !== 0) {
      if (p.baseY === undefined) { p.baseY = p.gapY; p.phase = w.rng() * Math.PI * 2; }
      p.gapY = p.baseY + Math.sin(w.t * 0.02 + p.phase) * p.drift * 55;
    }
    if (!p.scored && p.x + p.w < b.x) { p.scored = true; w.score++; ev.scored = true; }
  }
  w.pipes = w.pipes.filter((p) => p.x + p.w > -10);

  // collision
  const r = BIRD_R - HITBOX_SHRINK;
  if (b.y + r >= WORLD_H) {
    w.alive = false;
    ev.dead = true;
    return ev;
  }
  for (const p of w.pipes) {
    const top = { x: p.x, y: 0, w: p.w, h: p.gapY - p.gap / 2 };
    const bottom = { x: p.x, y: p.gapY + p.gap / 2, w: p.w, h: WORLD_H };
    if (circleRect(b.x, b.y, r, top) || circleRect(b.x, b.y, r, bottom)) {
      w.alive = false;
      ev.dead = true;
      break;
    }
  }
  return ev;
}
