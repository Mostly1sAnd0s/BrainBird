// Canvas renderer: synthwave sunset, parallax city, neon pipes, winged pixel
// brain, particles, screen shake. Pure draw code — reads world state, never mutates it.
import { WORLD_W, WORLD_H, BIRD_R } from './game.js';

// --- palette drift ----------------------------------------------------------

function hsl(h, s, l) { return `hsl(${((h % 360) + 360) % 360},${s}%,${l}%)`; }
function skyHue(t) { return 262 + 24 * Math.sin(t * 0.004) + Math.min(40, 0); }

// --- background layers -------------------------------------------------------

function drawSky(ctx, t) {
  const hue = skyHue(t);
  const g = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  g.addColorStop(0, hsl(hue, 70, 8));
  g.addColorStop(0.55, hsl(hue + 18, 75, 22));
  g.addColorStop(0.72, hsl(330, 85, 40));
  g.addColorStop(1, hsl(285, 70, 12));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // retro sun with slit bands
  const sx = WORLD_W * 0.72, sy = WORLD_H * 0.42, sr = 80;
  const sg = ctx.createLinearGradient(0, sy - sr, 0, sy + sr);
  sg.addColorStop(0, '#ffe36e');
  sg.addColorStop(0.5, '#ff7ad9');
  sg.addColorStop(1, '#7b2bff');
  ctx.save();
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = sg;
  ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  ctx.fillStyle = hsl(hue, 70, 10);
  for (let i = 0; i < 6; i++) {
    const y = sy + 8 + i * 12 + (t * 0.4) % 12;
    ctx.fillRect(sx - sr, y, sr * 2, 3 + i);
  }
  ctx.restore();

  // stars
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 40; i++) {
    const x = (i * 977) % WORLD_W, y = (i * 547) % (WORLD_H * 0.4);
    if ((i + Math.floor(t * 0.05)) % 7) ctx.fillRect(x, y, 2, 2);
  }
}

function drawGrid(ctx, t, speed) {
  const horizon = WORLD_H * 0.72;
  ctx.strokeStyle = hsl(300, 100, 55);
  ctx.lineWidth = 1;
  ctx.save();
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 12; i++) {
    const p = ((t * 0.06 * speed + i / 12) % 1) ** 2; // accelerating toward viewer
    const y = horizon + p * (WORLD_H - horizon);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_W, y); ctx.stroke();
  }
  for (let i = -10; i <= 10; i++) {
    ctx.beginPath();
    ctx.moveTo(WORLD_W / 2 + i * 40, horizon);
    ctx.lineTo(WORLD_W / 2 + i * 240, WORLD_H);
    ctx.stroke();
  }
  ctx.restore();

  // parallax city silhouette
  ctx.fillStyle = 'rgba(16, 4, 40, 0.95)';
  const off = (t * speed * 0.4) % 640;
  for (let pass = 0; pass < 2; pass++) {
    const base = horizon - 6;
    for (let i = 0; i < 20; i++) {
      const x = i * 64 - off + pass * 640;
      const h = 20 + ((i * 73) % 60);
      ctx.fillRect(x, base - h, 34, h);
      ctx.fillStyle = 'rgba(255, 43, 214, 0.5)';
      for (let w = 0; w < (h / 14) | 0; w++) ctx.fillRect(x + 6 + (w % 3) * 9, base - h + 6 + w * 12, 4, 5);
      ctx.fillStyle = 'rgba(16, 4, 40, 0.95)';
    }
  }
}

// --- pipes -------------------------------------------------------------------

function neonRect(ctx, x, y, w, h, hue, t) {
  ctx.fillStyle = hsl(hue, 80, 10);
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = hsl(hue, 100, 60);
  ctx.lineWidth = 2.5;
  ctx.shadowColor = hsl(hue, 100, 60);
  ctx.shadowBlur = 12;
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  ctx.shadowBlur = 0;
  // animated scanlines inside the pipe body
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = `hsla(${hue},100%,70%,0.16)`;
  for (let sy = ((t * 2) % 14) - 14; sy < y + h; sy += 14) ctx.fillRect(x, sy, w, 4);
  ctx.restore();
}

function drawPipes(ctx, world, t) {
  for (const p of world.pipes) {
    const topH = p.gapY - p.gap / 2;
    const botY = p.gapY + p.gap / 2;
    neonRect(ctx, p.x, 0, p.w, topH, 160, t);
    neonRect(ctx, p.x, botY, p.w, WORLD_H - botY, 160, t);
    // gap glow
    ctx.fillStyle = 'rgba(0,240,255,0.14)';
    ctx.fillRect(p.x - 3, topH, p.w + 6, p.gap);
  }
}

// --- the bird: a chunky pixel brain with wings -------------------------------

export function drawBird(ctx, bird, t, source) {
  const { x, y, rot } = bird;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);

  // wings flap fast right after an impulse
  const flapPhase = Math.sin(t * 0.9) * (bird.vy < 0 ? 1 : 0.45);
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath(); // far wing
  ctx.moveTo(-4, -2); ctx.lineTo(-16, -12 - flapPhase * 10); ctx.lineTo(-12, 2); ctx.closePath(); ctx.fill();

  // brain body: pink dome with sulci squiggles
  const glow = source === 'eeg' || source === 'sim' ? '#00f0ff' : '#ff2bd6';
  ctx.shadowColor = glow;
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#ff8fd0';
  ctx.beginPath();
  ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#c2185b';
  ctx.lineWidth = 1.6;
  for (const gy of [-6, 0, 6]) {
    ctx.beginPath();
    ctx.moveTo(-9, gy);
    ctx.quadraticCurveTo(-4, gy - 4, 0, gy);
    ctx.quadraticCurveTo(4, gy + 4, 9, gy);
    ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(0, -BIRD_R); ctx.lineTo(0, BIRD_R); ctx.stroke(); // hemispheres

  // near wing
  ctx.fillStyle = '#ffb01f';
  ctx.beginPath();
  ctx.moveTo(2, 0); ctx.lineTo(-10, -16 - flapPhase * 12); ctx.lineTo(-6, 4); ctx.closePath(); ctx.fill();

  // beak + eye
  ctx.fillStyle = '#ffe36e';
  ctx.beginPath(); ctx.moveTo(BIRD_R - 2, -2); ctx.lineTo(BIRD_R + 8, 1); ctx.lineTo(BIRD_R - 2, 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#12001f';
  ctx.beginPath(); ctx.arc(6, -4, 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// --- particles & effects ------------------------------------------------------

export function createFx() {
  const particles = [];
  let shake = 0, flash = 0;
  return {
    burst(x, y, n, color, spread = 3) {
      for (let i = 0; i < n; i++) {
        particles.push({ x, y, vx: (Math.random() - 0.5) * spread * 2, vy: (Math.random() - 0.8) * spread * 2,
          life: 30 + Math.random() * 30, color, size: 2 + Math.random() * 3 });
      }
    },
    hit() { shake = 14; flash = 1; },
    screenFlash() { flash = 0.6; },
    step(dtf) {
      shake = Math.max(0, shake - dtf);
      flash = Math.max(0, flash - 0.06 * dtf);
      for (const p of particles) { p.x += p.vx * dtf; p.y += p.vy * dtf; p.vy += 0.12 * dtf; p.life -= dtf; }
      for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
    },
    draw(ctx) {
      for (const p of particles) {
        ctx.globalAlpha = Math.min(1, p.life / 20);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      ctx.globalAlpha = 1;
      if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.35})`; ctx.fillRect(0, 0, WORLD_W, WORLD_H); }
    },
    get shake() { return shake; },
  };
}

// --- frame --------------------------------------------------------------------

export function render(ctx, world, fx, tMs, flapSource) {
  const t = world.t;
  ctx.save();
  if (fx.shake > 0) ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
  drawSky(ctx, t);
  drawGrid(ctx, t, 1);
  drawPipes(ctx, world, t);
  drawBird(ctx, world.bird, t, flapSource);
  fx.draw(ctx);
  ctx.restore();
}
