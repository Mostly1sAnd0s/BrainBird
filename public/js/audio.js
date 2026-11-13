// All audio is synthesized with WebAudio — no asset files. One AudioContext,
// separate music and SFX buses, gated by user settings. Musical content is
// composed data from music.js; this module only schedules and voices it.
import { buildSong } from './music.js';

let ctx = null, master = null, musicBus = null, sfxBus = null;
let musicOn = true, sfxOn = true, volume = 0.7;
let musicTimer = null;

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
  osc.onended = () => { osc.disconnect(); g.disconnect(); };
}

function noiseBurst({ dur = 0.12, freq = 1200, q = 2, gain = 0.3, bus = null, delay = 0 }) {
  if (!ctx) return;
  const t0 = ctx.currentTime + Math.max(0, delay);
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
  src.connect(bp).connect(g).connect(bus || sfxBus);
  src.start(t0);
  src.onended = () => { src.disconnect(); bp.disconnect(); g.disconnect(); };
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

// --- music: lookahead scheduler playing the composed song (music.js) --------

let song = buildSong(7);
let SPB = 60 / song.bpm; // seconds per beat
let songStart = 0; // ctx time of the current loop's beat 0
let songIdx = 0; // next event index to schedule

function playEvent(e, at) {
  const dur = Math.max(0.03, e.dur * SPB);
  const delay = Math.max(0, at - ctx.currentTime);
  switch (e.kind) {
    case 'bass':
      tone(e.freq, { type: 'sawtooth', dur, gain: e.gain, bus: musicBus, delay });
      break;
    case 'arp':
      tone(e.freq, { type: 'square', dur: Math.min(dur, 0.09), gain: e.gain, bus: musicBus, delay });
      break;
    case 'lead': // detuned pair for width — the vocal of the track
      tone(e.freq, { type: 'triangle', dur, gain: e.gain, bus: musicBus, delay });
      tone(e.freq * 1.003, { type: 'triangle', dur, gain: e.gain * 0.6, bus: musicBus, delay });
      break;
    case 'hat':
      noiseBurst({ dur: 0.04, freq: 8000, q: 1.2, gain: e.gain, bus: musicBus, delay });
      break;
    case 'snare':
      noiseBurst({ dur: 0.11, freq: 1800, q: 0.8, gain: e.gain, bus: musicBus, delay });
      tone(190, { type: 'triangle', dur: 0.08, gain: e.gain * 0.5, bus: musicBus, delay });
      break;
  }
}

export function startMusic() {
  initAudio();
  if (!musicOn || musicTimer) return;
  // fresh arrangement every run: same style, new melody/drive variations
  song = buildSong((Math.random() * 2 ** 31) | 0);
  SPB = 60 / song.bpm;
  songStart = ctx.currentTime + 0.1;
  songIdx = 0;
  musicTimer = setInterval(() => {
    const horizon = ctx.currentTime + 0.5;
    while (songIdx < song.events.length) {
      const e = song.events[songIdx];
      const at = songStart + e.t * SPB;
      if (at >= horizon) break;
      // 30ms late-tolerance absorbs setInterval jitter (playEvent floors delay
      // at 0). Events later than that — a throttled background tab — are
      // skipped rather than stacked into a stuttered blast when we wake up.
      if (at > ctx.currentTime - 0.03) playEvent(e, at);
      songIdx++;
      if (songIdx >= song.events.length) { songIdx = 0; songStart += song.loopBeats * SPB; }
    }
  }, 200);
}

export function stopMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}

// Score milestone: jump the playhead one 8-bar section ahead, so a hot run
// lands on the fuller arrangement sooner. No-op near the loop end (the
// natural wrap arrives before a skip would help).
export function advanceMusicSection() {
  if (!musicTimer || !ctx) return;
  const nowBeat = (ctx.currentTime - songStart) / SPB;
  const target = nowBeat + 8 * 4;
  let i = songIdx;
  while (i < song.events.length && song.events[i].t < target) i++;
  if (i < song.events.length) songIdx = i;
}
