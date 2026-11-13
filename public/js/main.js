// BrainBird client entry: fixed-timestep loop, state machine, input routing,
// EEG wiring with debounce + latency readout. Game rules live in game.js (tested).
import { createWorld, flap, stepWorld, clampGravity, WORLD_H } from './game.js';
import { render, createFx } from './render.js';
import { initAudio, startMusic, stopMusic, setSettings, sfxFlap, sfxScore, sfxHit, sfxLevelUp } from './audio.js';
import { createEegClient, serialSupported } from './serial.js';
import { createEegSim } from './eegsim.js';
import { createDebouncer, createConfidenceGate } from './eeg.js';
import { fetchHighScores, submitScore } from './net.js';
import { createUi, saveSettings } from './ui.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let world = createWorld();
const fx = createFx();
let state = 'menu'; // menu | play | dead (world keeps scrolling behind overlays)
let flapSource = 'keyboard';
let settings = { gravity: 0.35, gate: 0.5 }; // merged with localStorage at boot

const flapDebouncer = createDebouncer(250); // EEG flaps only; spacebar is raw
const confidenceGate = createConfidenceGate(() => settings.gate);

// --- state transitions -------------------------------------------------------

function resetWorld() {
  world = createWorld({ gravity: clampGravity(settings.gravity) });
  ui.setScore(0);
}

function startGame() {
  if (state === 'play') return;
  initAudio();
  startMusic();
  resetWorld();
  state = 'play';
  ui.showMenu(false);
  ui.showGameOver(false);
  ui.showStatusbar(true);
  doFlap('keyboard');
}

function toMenu() {
  state = 'menu';
  resetWorld();
  ui.showMenu(true);
  ui.showGameOver(false);
  ui.closeSettings();
  ui.showStatusbar(false);
  stopMusic();
}

function die() {
  state = 'dead';
  sfxHit();
  fx.hit();
  fx.burst(world.bird.x, world.bird.y, 26, '#ff8fd0', 4);
  ui.setFinalScore(world.score);
  ui.showGameOver(true);
  stopMusic();
}

function doFlap(source) {
  if (state !== 'play') return;
  flapSource = source;
  flap(world);
  sfxFlap(source);
  ui.flashFlap(source === 'keyboard' ? 'kbd' : 'ok');
  fx.burst(world.bird.x - 10, world.bird.y + 6, 3, '#00f0ff', 1.2);
}

// --- input --------------------------------------------------------------------

function primaryAction() { // space
  if (ui.settingsOpen()) return;
  if (state === 'menu') startGame();
  else if (state === 'dead') startGame();
  else doFlap('keyboard');
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (ui.settingsOpen()) ui.closeSettings();
    else toMenu(); // from play (abandons the run) or from game-over
    return;
  }
  if (e.code !== 'Space') return;
  const typing = document.activeElement?.tagName === 'INPUT';
  if (typing) return; // let the name field take spaces
  e.preventDefault();
  primaryAction();
});

// --- EEG ----------------------------------------------------------------------

const eeg = {
  client: null,
  sim: null,
  pair() { return this.client.pair(); },
  disconnect() { return this.client.disconnect(); },
  listPaired() { return this.client.listPaired(); },
  connectSelected(idx) {
    this.client.listPaired().then((ports) => {
      const p = ports[Number(idx)];
      if (p) this.client.connect(p);
    });
  },
};

function handleEegEvent(ev, nowMs) {
  if (ev.type === 'strength') {
    ui.setStrength(Math.min(1, ev.value / 1024));
    ui.setSignal(Math.min(1, ev.value / 1024));
    return;
  }
  if (ev.type !== 'flap') return;
  const src = eeg.sim?.running && !eeg.client?.port ? 'sim' : 'eeg';
  const latency = Math.round(performance.now() - nowMs);
  if (latency >= 0 && latency < 1000) ui.setLatency(latency);
  // the user's cognitive jump point: soft intents are visible but silent
  if (!confidenceGate(ev.confidence)) {
    ui.flashFlap('no');
    return;
  }
  if (!flapDebouncer(nowMs)) return;
  if (state === 'menu' || state === 'dead') startGame();
  else doFlap(src);
}

// --- UI -----------------------------------------------------------------------

const ui = createUi({
  onSubmitScore: async (name) => {
    if (!name || world.score <= 0) return null;
    try { return await submitScore({ name, score: world.score, source: flapSource }); }
    catch { return null; }
  },
  onSettingsChange: (s) => {
    Object.assign(settings, s);
    saveSettings(settings);
    setSettings(s); // music/sfx/volume only reads the keys it knows
    world.gravity = clampGravity(s.gravity); // live-tune mid-flight
    if (s.sim) eeg.sim?.start();
    else eeg.sim?.stop();
  },
  onMenu: () => toMenu(),
});

// --- main loop (fixed timestep, render every frame) ----------------------------

const STEP = 1 / 60;
let acc = 0, prev = performance.now();

function frame(now) {
  let dt = (now - prev) / 1000;
  prev = now;
  if (dt > 0.25) dt = 0.25; // tab was backgrounded: don't fast-forward
  acc += dt;
  while (acc >= STEP) {
    acc -= STEP;
    const ev = stepWorld(world, STEP);
    if (state === 'play') {
      if (ev.scored) {
        ui.setScore(world.score);
        sfxScore(world.score);
        fx.burst(world.bird.x + 20, world.bird.y, 6, '#00f0ff', 2);
        if (world.score % 10 === 0) { sfxLevelUp(); fx.screenFlash(); }
      }
      if (ev.dead) die();
    } else if (world.bird) {
      // attract mode: autopilot keeps the brain bird bobbing behind menus
      world.bird.vy += -0.02;
      if (Math.random() < 0.05) flap(world);
      if (ev.dead) resetWorld();
    }
    fx.step(1);
  }
  render(ctx, world, fx, now, flapSource);
  requestAnimationFrame(frame);
}

// --- boot -----------------------------------------------------------------------

(async function boot() {
  eeg.client = createEegClient(handleEegEvent, (stateName, detail) => {
    ui.setConn(stateName, detail);
    if (stateName === 'connected') ui.refreshPortList();
  });
  eeg.sim = createEegSim(handleEegEvent);
  ui.serialSupported(serialSupported(), 'Web Serial needs Chrome/Edge over HTTPS or localhost. Spacebar still works!');
  eeg.client.watchHotplug();
  eeg.client.autoConnect();
  try { ui.renderScores(await fetchHighScores()); } catch {}
  requestAnimationFrame(frame);
})();
