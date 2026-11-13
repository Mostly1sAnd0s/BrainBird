// Regression tests for the object-literal scope trap in ui.js: sibling methods
// are NOT in each other's scope, so a bare call inside one (refreshPortList,
// setConn) throws ReferenceError and silently aborts transitions (the
// menu-shows-behind-FLATLINE bug). These tests run createUi against a minimal
// DOM stub — no jsdom.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createUi } from './ui.js';

function stubEl() {
  const el = {
    classes: new Set(),
    style: {}, children: [],
    value: '0.5', checked: true, textContent: '', innerHTML: '',
    listeners: {},
    classList: {
      toggle(c, on) { on ? el.classes.add(c) : el.classes.delete(c); },
      add(c) { el.classes.add(c); },
      contains(c) { return el.classes.has(c); },
    },
    querySelector() { return stubEl(); },
    appendChild(c) { el.children.push(c); },
    addEventListener(type, fn) { (el.listeners[type] ??= []).push(fn); },
    fire(type) { for (const fn of el.listeners[type] ?? []) fn({ preventDefault() {} }); },
  };
  return el;
}

let registry;
function installStubDom() {
  registry = new Map();
  globalThis.document = {
    getElementById(id) {
      if (!registry.has(id)) registry.set(id, stubEl());
      return registry.get(id);
    },
    createElement() { return stubEl(); },
  };
}
const registryEl = (id) => document.getElementById(id); // same lazy registry

test('showMenu(true) completes fully instead of throwing on refreshPortList', () => {
  installStubDom();
  const eeg = { listPaired: async () => [] };
  const ui = createUi({ onSubmitScore: async () => null, onSettingsChange: () => {}, onMenu: () => {}, eeg });
  // Before the fix this threw ReferenceError: refreshPortList is not defined,
  // which aborted toMenu() before the FLATLINE overlay got hidden.
  ui.showMenu(true);
  assert.equal(registryEl('menu').classList.contains('hidden'), false, 'menu revealed');
  assert.doesNotThrow(() => ui.showMenu(true));
});

test('every settings control re-emits on change', () => {
  installStubDom();
  const seen = [];
  createUi({ onSubmitScore: async () => null, onSettingsChange: (s) => seen.push(s), onMenu: () => {}, eeg: { listPaired: async () => [] } });
  const ids = ['musicOn', 'sfxOn', 'volume', 'simOn', 'gravity', 'gate'];
  const missing = ids.filter((id) => registryEl(id).listeners.change?.length !== 1);
  assert.deepEqual(missing, [], 'each control needs exactly one change listener');
});

test('moving the drop-speed slider applies its new value, not the default', () => {
  installStubDom();
  const seen = [];
  createUi({ onSubmitScore: async () => null, onSettingsChange: (s) => seen.push(s), onMenu: () => {}, eeg: { listPaired: async () => [] } });
  registryEl('gravity').value = '0.12'; // user drags to the floaty end
  registryEl('gravity').fire('change');
  const latest = seen.at(-1);
  assert.equal(latest.gravity, 0.12, 'change must carry the dragged value');
  assert.equal(registryEl('dropVal').textContent, '0.12', 'status bar must reflect it');
});

test('moving the jump-threshold slider applies its new value everywhere', () => {
  installStubDom();
  const seen = [];
  createUi({ onSubmitScore: async () => null, onSettingsChange: (s) => seen.push(s), onMenu: () => {}, eeg: { listPaired: async () => [] } });
  registryEl('gate').value = '0.85';
  registryEl('gate').fire('change');
  assert.equal(seen.at(-1).gate, 0.85);
  assert.equal(registryEl('gateVal').textContent, 'gate 0.85');
  assert.equal(registryEl('gateReadout').textContent, '0.85');
  assert.equal(registryEl('gateTick').style.left, '85%');
});

test('persisted gravity and gate restore into sliders and the first emit', () => {
  installStubDom();
  const saved = JSON.stringify({ music: true, sfx: true, vol: 0.7, gravity: 0.2, gate: 0.9 });
  globalThis.localStorage = { getItem: () => saved, setItem: () => {} };
  const seen = [];
  createUi({ onSubmitScore: async () => null, onSettingsChange: (s) => seen.push(s), onMenu: () => {}, eeg: { listPaired: async () => [] } });
  assert.equal(registryEl('gravity').value, '0.2');
  assert.equal(registryEl('gate').value, '0.9');
  assert.equal(seen.at(-1).gravity, 0.2, 'boot emit must carry persisted values, not HTML defaults');
  assert.equal(seen.at(-1).gate, 0.9);
  delete globalThis.localStorage;
});

test('a full menu transition (toMenu order) reveals menu and hides gameover', () => {
  installStubDom();
  const ui = createUi({ onSubmitScore: async () => null, onSettingsChange: () => {}, onMenu: () => {}, eeg: { listPaired: async () => [] } });
  ui.showGameOver(true); // dead
  ui.showMenu(true);    // menu up...
  ui.showGameOver(false); // ...flatline cleared — must all run in sequence
  assert.equal(registryEl('gameover').classList.contains('hidden'), true);
  assert.equal(registryEl('menu').classList.contains('hidden'), false);
});
