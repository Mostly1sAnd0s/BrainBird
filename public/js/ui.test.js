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
    classList: {
      toggle(c, on) { on ? el.classes.add(c) : el.classes.delete(c); },
      add(c) { el.classes.add(c); },
      contains(c) { return el.classes.has(c); },
    },
    querySelector() { return stubEl(); },
    appendChild(c) { el.children.push(c); },
    addEventListener() {},
  };
  return el;
}

function installStubDom() {
  const registry = new Map();
  globalThis.document = {
    getElementById(id) {
      if (!registry.has(id)) registry.set(id, stubEl());
      return registry.get(id);
    },
    createElement() { return stubEl(); },
  };
  return registry;
}

test('showMenu(true) completes fully instead of throwing on refreshPortList', () => {
  const reg = installStubDom();
  const eeg = { listPaired: async () => [] };
  const ui = createUi({ onSubmitScore: async () => null, onSettingsChange: () => {}, onMenu: () => {}, eeg });
  // Before the fix this threw ReferenceError: refreshPortList is not defined,
  // which aborted toMenu() before the FLATLINE overlay got hidden.
  ui.showMenu(true);
  assert.equal(reg.get('menu').classList.contains('hidden'), false, 'menu revealed');
  assert.doesNotThrow(() => ui.showMenu(true));
});

test('a full menu transition (toMenu order) reveals menu and hides gameover', () => {
  const reg = installStubDom();
  const ui = createUi({ onSubmitScore: async () => null, onSettingsChange: () => {}, onMenu: () => {}, eeg: { listPaired: async () => [] } });
  ui.showGameOver(true); // dead
  ui.showMenu(true);    // menu up...
  ui.showGameOver(false); // ...flatline cleared — must all run in sequence
  assert.equal(reg.get('gameover').classList.contains('hidden'), true);
  assert.equal(reg.get('menu').classList.contains('hidden'), false);
});
