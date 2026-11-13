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

export function createUi({ onStartSubmit, onSubmitScore, onSettingsChange, eeg }) {
  const el = {
    menu: $('menu'), gameover: $('gameover'), settings: $('settings'),
    score: $('score'), finalScore: $('finalScore'), rankMsg: $('rankMsg'),
    hiscores: $('hiscores').querySelector('tbody'),
    playerName: $('playerName'),
    musicOn: $('musicOn'), sfxOn: $('sfxOn'), volume: $('volume'),
    connStatus: $('connStatus'), strengthBar: $('strengthBar').querySelector('i'),
    latency: $('latency'), portList: $('portList'), simOn: $('simOn'),
  };

  const show = (node, on) => node.classList.toggle('hidden', !on);

  function emitSettings() {
    onSettingsChange({
      music: el.musicOn.checked, sfx: el.sfxOn.checked, vol: el.volume.value / 100,
      sim: el.simOn.checked,
    });
  }

  // settings wiring
  $('openSettings').addEventListener('click', () => show(el.settings, true));
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
    showGameOver(on) { show(el.gameover, on); },
    setScore(n) { el.score.textContent = n > 0 ? n : ''; },
    setFinalScore(n) { el.finalScore.textContent = `SCORE ${n}`; },
    renderScores(scores) {
      el.hiscores.innerHTML = '';
      scores.slice(0, 10).forEach((e, i) => {
        const tr = document.createElement('tr');
        const badge = e.source === 'eeg' ? ' 🧠' : e.source === 'sim' ? ' 🎛' : '';
        tr.innerHTML = `<td>${i + 1}. ${e.name}${badge}</td><td>${e.score}</td>`;
        el.hiscores.appendChild(tr);
      });
    },
    setConn(state, detail = '') {
      el.connStatus.textContent = state;
      el.connStatus.className = 'chip' + (state === 'connected' ? ' on' : state === 'error' ? ' err' : '');
      if (detail) el.latency.textContent = detail;
    },
    setStrength(v01) { el.strengthBar.style.width = `${Math.round(v01 * 100)}%`; },
    setLatency(ms) { el.latency.textContent = `last EEG flap latency: ${ms} ms`; },
    async refreshPortList() {
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
    },
    serialSupported(on, hint) {
      if (!on) {
        $('serialSupport').textContent = hint;
        $('pairBtn').disabled = true;
      }
    },
  };
}
