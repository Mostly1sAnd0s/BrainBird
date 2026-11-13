// All audio is synthesized with WebAudio — no asset files. One AudioContext,
// separate music and SFX buses, gated by user settings.

let ctx = null, master = null, musicBus = null, sfxBus = null;
let musicOn = true, sfxOn = true, volume = 0.7;
let musicTimer = null, stepIdx = 0;

export function initAudio() {
  if (ctx) return ctx;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  musicBus = ctx.createGain();
  musicBus.connect(master);
  sfxBus = ctx.createGain();
  sfxBus.connect(master);
  return ctx;
}

export function setSettings({ music, sfx, vol }) {
  if (music !== undefined) musicOn = music;
  if (sfx !== undefined) sfxOn = sfx;
  if (vol !== undefined) volume = vol;
  if (master) master.gain.value = volume;
  if (!musicOn) stopMusic();
}

function tone(freq, { type = 'square', dur = 0.15, gain = 0.25, bus = sfxBus, slide = 0, delay = 0 }) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g).connect(bus);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noiseBurst({ dur = 0.12, freq = 1200, q = 2, gain = 0.3 }) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(bp).connect(g).connect(sfxBus);
  src.start(t0);
}

// --- game events -----------------------------------------------------------

export function sfxFlap(source = 'keyboard') {
  if (!sfxOn) return;
  initAudio();
  if (source === 'keyboard') {
    noiseBurst({ dur: 0.09, freq: 900, gain: 0.25 });
  } else {
    // EEG flap: a shimmering "psychic" chord so the player hears their brain.
    const f = source === 'sim' ? 220 : 261.6;
    tone(f, { type: 'sine', dur: 0.22, gain: 0.18 });
    tone(f * 1.5, { type: 'sine', dur: 0.22, gain: 0.12, delay: 0.02 });
    tone(f * 2, { type: 'sine', dur: 0.25, gain: 0.08, delay: 0.04 });
  }
}

const PENTA = [523.25, 587.33, 659.25, 783.99, 880];
export function sfxScore(streak) {
  if (!sfxOn) return;
  initAudio();
  tone(PENTA[streak % PENTA.length], { type: 'triangle', dur: 0.18, gain: 0.3 });
  tone(PENTA[streak % PENTA.length] * 2, { type: 'sine', dur: 0.12, gain: 0.12, delay: 0.05 });
}

export function sfxHit() {
  if (!sfxOn) return;
  initAudio();
  tone(180, { type: 'square', dur: 0.35, gain: 0.35, slide: -140 });
  noiseBurst({ dur: 0.3, freq: 300, gain: 0.4 });
}

export function sfxLevelUp() {
  if (!sfxOn) return;
  initAudio();
  [0, 1, 2, 4].forEach((n, i) => tone(PENTA[n], { type: 'square', dur: 0.12, gain: 0.22, delay: i * 0.07 }));
}

// --- music: 8-step synthwave arpeggio, scheduled ahead ----------------------

const BASS = [55, 55, 82.4, 55, 65.4, 65.4, 49, 61.7]; // A1 A1 E2 A1 C2 C2 G1 B1

export function startMusic() {
  initAudio();
  if (!musicOn || musicTimer) return;
  let nextTime = ctx.currentTime + 0.1;
  musicTimer = setInterval(() => {
    while (nextTime < ctx.currentTime + 0.5) {
      const f = BASS[stepIdx % BASS.length];
      tone(f, { type: 'sawtooth', dur: 0.22, gain: 0.14, bus: musicBus, delay: nextTime - ctx.currentTime });
      tone(f * 4, { type: 'square', dur: 0.09, gain: 0.03, bus: musicBus, delay: nextTime - ctx.currentTime });
      nextTime += 0.24;
      stepIdx++;
    }
  }, 200);
}

export function stopMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}
