// Procedural pipe generation. All randomness flows through an injected rng so
// the whole obstacle field is reproducible from one seed.
import { WORLD_H } from './game.js';

export const PIPE_W = 52;
const EDGE_MARGIN = 30; // never seal the gap against sky or floor

// Pure curve: no rng unless a coin flip for moving pipes is wanted (spawn time only,
// never per-frame — the physics loop calls this for speed on every step).
export function difficultyFor(score, rng = null) {
  const t = Math.min(1, score / 60); // full difficulty at score 60
  const gap = 170 - 50 * t; // 170 -> 120 px
  const speed = 2.4 + 1.8 * t; // 2.4 -> 4.2 px/frame (60 Hz)
  const spawnDist = 260 + 40 * (1 - t); // tighter later, plus jitter below
  const moving = score >= 25 && rng !== null && rng() < 0.25;
  return { gap, speed, spawnDist, moving };
}

// One pipe pair at x, sized for the current score. nextSpawnIn is the pixel
// distance the world scrolls before the next pipe (interval jitter +/-15%).
export function spawnPipe(x, score, rng = Math.random) {
  const d = difficultyFor(score, rng);
  const minY = EDGE_MARGIN + d.gap / 2;
  const maxY = WORLD_H - EDGE_MARGIN - d.gap / 2;
  return {
    x,
    w: PIPE_W,
    gapY: minY + rng() * (maxY - minY),
    gap: d.gap,
    scored: false,
    drift: d.moving ? (rng() < 0.5 ? -1 : 1) * (0.4 + rng() * 0.5) : 0, // px/frame sine drift
    nextSpawnIn: d.spawnDist * (0.85 + rng() * 0.3),
  };
}
