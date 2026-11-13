// DOM glue: settings modal, scoreboard, game-over name entry, EEG status chip.
// No game logic here — this module only reads/writes the DOM and calls back.

const $ = (id) => document.getElementById(id);

export function loadSettings() {
  try { return JSON.parse(localStorage.getItem('brainbird.settings')) ?? {}; }
  catch { return {}; }
}
export function saveSettings(s) {
  localStorage.setItem('brainbird.settings', JSON.stringify(s));
}

export function createUi({ onSubmitScore, onSettingsChange, onMenu, eeg }) {
  const el = {
    menu: $('menu'), gameover: $('gameover'), settings: $('settings'),
    score: $('score'), finalScore: $('finalScore'), rankMsg: $('rankMsg'),
    hiscores: $('hiscores').querySelector('tbody'),
    playerName: $('playerName'),
    musicOn: $('musicOn'), sfxOn: $('sfxOn'), volume: $('volume'),
    gravity: $('gravity'), gate: $('gate'), gateReadout: $('gateReadout'),
    statusbar: $('statusbar'), signalFill: $('signalBar').querySelector('i'),
    gateTick: $('gateTick'), gateVal: $('gateVal'), flapLight: $('flapLight'), dropVal: $('dropVal'),
    connStatus: $('connStatus'), strengthBar: $('strengthBar').querySelector('i'),
    latency: $('latency'), portList: $('portList'), simOn: $('simOn'),
  };

  const show = (node, on) => node.classList.toggle('hidden', !on);

  // Helper functions live in lexical scope on purpose. Object-literal sibling
  // methods cannot call each other by bare name — that reference error is what
  // once left FLATLINE painted over the menu (see ui.test.js).
  async function refreshPortList() {
    const ports = await eeg.listPaired();
    el.portList.innerHTML = '';
    ports.forEach((p, i) => {
      const o = document.createElement('option');
      const info = p.getInfo?.() || {};
      o.value = String(i);
      o.textContent = info.productId ? `PID ${info.productId.toString(16)} / VID ${info.vendorId.toString(16)}` : `paired device ${i + 1}`;
      el.portList.appendChild(o);
    });
    if (!ports.length) {
      const o = document.createElement('option');
      o.textContent = 'no paired devices';
      el.portList.appendChild(o);
    }
  }

  function setConn(state, detail = '') {
    el.connStatus.textContent = state;
    el.connStatus.className = 'chip' + (state === 'connected' ? ' on' : state === 'error' ? ' err' : '');
    if (detail) el.latency.textContent = detail;
  }

  function renderScores(scores) {
    el.hiscores.innerHTML = '';
    scores.slice(0, 10).forEach((e, i) => {
      const tr = document.createElement('tr');
      const badge = e.source === 'eeg' ? ' 🧠' : e.source === 'sim' ? ' 🎛' : '';
      tr.innerHTML = `<td>${i + 1}. ${e.name}${badge}</td><td>${e.score}</td>`;
      el.hiscores.appendChild(tr);
    });
  }

  function emitSettings() {
    onSettingsChange({
      music: el.musicOn.checked, sfx: el.sfxOn.checked, vol: el.volume.value / 100,
      sim: el.simOn.checked, gravity: Number(el.gravity.value), gate: Number(el.gate.value),
    });
    el.gateReadout.textContent = Number(el.gate.value).toFixed(2);
    el.gateTick.style.left = `${el.gate.value * 100}%`;
    el.gateVal.textContent = `gate ${Number(el.gate.value).toFixed(2)}`;
    el.dropVal.textContent = Number(el.gravity.value).toFixed(2);
  }

  // settings wiring
  $('openSettings').addEventListener('click', () => show(el.settings, true));
  $('menuBtn').addEventListener('click', onMenu);
  $('closeSettings').addEventListener('click', () => show(el.settings, false));
  for (const input of [el.musicOn, el.sfxOn, el.volume, el.simOn]) input.addEventListener('change', emitSettings);

  $('pairBtn').addEventListener('click', () => eeg.pair().catch((err) => setConn('err', err.message)));
  $('connBtn').addEventListener('click', async () => {
    if (eeg.client?.port) await eeg.disconnect();
    else eeg.connectSelected(el.portList.value);
  });

  $('scoreForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const r = await onSubmitScore(el.playerName.value.trim());
    if (r) { el.rankMsg.textContent = r.rank ? `RANK #${r.rank} ON THE BOARD!` : 'NOT ON THE BOARD THIS TIME'; el.playerName.value = ''; renderScores(r.board); }
  });

  // restore persisted settings into the controls
  const s = loadSettings();
  if (s.music === false) el.musicOn.checked = false;
  if (s.sfx === false) el.sfxOn.checked = false;
  if (typeof s.vol === 'number') el.volume.value = String(Math.round(s.vol * 100));
  emitSettings();

  return {
    showMenu(on) { show(el.menu, on); if (on) refreshPortList(); },
    settingsOpen() { return !el.settings.classList.contains('hidden'); },
    closeSettings() { show(el.settings, false); },
    showStatusbar(on) { show(el.statusbar, on); },
    // flap verdict light: did the last intent clear the user's jump threshold?
    flashFlap(kind) { // 'ok' | 'no' | 'kbd'
      el.flapLight.className = kind;
      el.flapLight.textContent = kind === 'ok' ? 'FLAP \u{1F4AA}' : kind === 'no' ? 'TOO SOFT' : 'KEY';
    },
    setSignal(v01) { el.signalFill.style.width = `${Math.min(100, v01 * 100)}%`; },
    showGameOver(on) { show(el.gameover, on); },
    setScore(n) { el.score.textContent = n > 0 ? n : ''; },
    setFinalScore(n) { el.finalScore.textContent = `SCORE ${n}`; },
    renderScores,
    setConn,
    setStrength(v01) { el.strengthBar.style.width = `${Math.round(v01 * 100)}%`; },
    setLatency(ms) { el.latency.textContent = `last EEG flap latency: ${ms} ms`; },
    refreshPortList,
    serialSupported(on, hint) {
      if (!on) {
        $('serialSupport').textContent = hint;
        $('pairBtn').disabled = true;
      }
    },
  };
}
