# BrainBird — Plan

An original one-button arcade flying game in the vein of classic horizontal-scrolling arcade games, controlled by spacebar or a live EEG stream from an Arduino over USB serial. Locally hosted Node server, browser game client, LAN-accessible.

## 1. Architecture

```
Arduino (EEG sensor) --USB/serial--> Browser (Web Serial API) --> Canvas game
                                         |
                                    fetch() to Node server --> high score store (JSON file)
```

- **Client owns the Arduino.** Each player plugs the EEG device into their *own* computer and the browser reads it directly through the **Web Serial API** (`navigator.serial`). No server-side serial, no WebSocket for EEG — zero latency hop.
- **Server (Node + Express):** static file host + high-score API only. It never touches the serial port.
- **Secure-context requirement:** Web Serial only exists on `localhost` or HTTPS. The server therefore runs **HTTPS with a self-signed certificate** (generated on first boot). LAN clients accept the one-time cert warning, then get full EEG support. HTTP on localhost also works for development.
- **Spacebar always works** as a fallback flap. EEG events and spacebar feed the same `flap()` path.

## 2. Repo layout

```
BrainBird/
  package.json
  server/
    index.js        # Express static + HTTPS on 0.0.0.0:8443 (HTTP 8788 for localhost dev)
    cert.js         # generate self-signed cert on first boot (selfsigned pkg), cache in certs/
    scores.js       # GET/POST /api/scores, persisted to data/scores.json
  data/
    scores.json     # top 10: {name, score, ts, source: "eeg"|"keyboard"}
  public/
    index.html
    css/ui.css
    js/
      main.js       # boot, state machine (menu/play/gameover/settings)
      game.js       # fixed-timestep loop, physics, collision
      pipes.js      # procedural obstacle generator
      bird.js       # bird animation + particle trail
      render.js     # parallax layers, palette, screen shake
      audio.js      # WebAudio synth: flap, score, hit, music loop
      input.js      # spacebar + EEG events -> flap()
      serial.js     # Web Serial: pair, connect, read loop, line parser, debounce
      eegsim.js     # simulated EEG stream (spacebar-paced F:/S: lines) for hardware-free testing
      net.js        # fetch wrapper for score API + server health
      ui.js         # settings page, paired-port dropdown, score entry
    assets/         # favicon only; everything else drawn/synthesized in code
  arduino/
    brainbird_eeg/brainbird_eeg.ino   # reference sketch + protocol docs
```

## 3. EEG protocol (Arduino side)

Line-based protocol over USB serial at 115200 baud, one ASCII line per event/sample:

- `F:<confidence>` — detected flap intent (e.g., attention spike or motor-imagination burst, already thresholded on-device).
- `S:<value>` — raw/filtered signal value at ~10–30 Hz, for the signal-strength meter.

Rationale: do band-power/threshold detection **on the Arduino** and send discrete events. The browser should not do DSP on a noisy serial stream. The reference sketch ships with a tunable threshold constant. The client does light debouncing (min 250 ms between flaps) to avoid bursts.

## 4. Serial handling (client, Web Serial API)

- **Pairing:** first time, a "Pair device" button calls `navigator.serial.requestPort()`; the browser shows its native device picker. After that the device is remembered — `navigator.serial.getPorts()` lists paired ports, shown in the settings dropdown with a Connect/Disconnect button per entry.
- **Read loop:** `port.readable` → `TextDecoderStream` → line splitter → parser for `F:` / `S:` lines. Disconnect handled via `port.close()` and `navigator.serial` `connect`/`disconnect` events; status chip updates live.
- **Reconnect:** `getPorts()` auto-connects a previously paired Arduino on page load and page refresh; if unplugged mid-game the client falls back to spacebar silently and reconnects when the device returns.
- **Simulation mode:** settings toggle runs `eegsim.js`, which emits synthetic `F:`/`S:` lines on a timer through the same parser, so the whole EEG path is testable with no hardware.

## 4b. Server details

- `GET /api/scores` / `POST /api/scores` — top-10 list, persisted server-side so all LAN players share one leaderboard.
- Generates a self-signed cert on first boot (`certs/` is gitignored); binds HTTPS `0.0.0.0:8443` plus plain HTTP `8788` bound to localhost for development. Prints LAN URLs on boot. No auth (LAN-only tool).

## 5. Gameplay

- Fixed 60 Hz physics accumulator (delta clamped, tab-out safe). Gravity + impulse flap, rotation lerped to velocity.
- Procedural pipes: gap size eases from 170→120 px, spawn interval jitters ±10%, speed ramps 2.4→4.2 px/frame with score. Occasional moving pipe (sine drift) above score 20.
- Collision: circle-vs-rect for the bird, forgiving 4 px hitbox shrink.
- Score: +1 per pipe pair, punchy sound + score pop animation. Every 10 points: flash + palette shift.
- Death: screen shake, feather particles, freeze-frame, then game-over card with name entry → saved high score.

## 6. Visuals & audio (the fun part)

- **Theme: "Synthbrain Neon."** Retro-synthwave: gradient sunset sky, glowing grid horizon, parallax city silhouette, neon-outlined pipes with animated scanlines, chromatic-aberration-ish glow on the bird via canvas shadowBlur. Bird is a chunky pixel brain with wings (drawn procedurally, animated 3-frame flap).
- Background palette cycles slowly; spikes on scoring.
- **Audio:** all WebAudio synthesis, zero asset files. 4-note arpeggiated bass loop (toggleable), flap = filtered noise blip, score = pentatonic ping, death = descending sizzle. EEG flap gets a distinct "psychic" chord vs. spacebar's plain blip, so the player can hear their brain working.
- All sounds gated by settings toggles; music uses a single scheduled oscillator graph to stay cheap.

## 7. Settings page (modal)

- Toggles: Music on/off, SFX on/off.
- Serial: paired-port dropdown + "Pair new device" button, Connect/Disconnect, live status chip (green/red) + signal-strength bar fed by `S:` lines. Shows a hint if the browser lacks Web Serial (Firefox/Safari: use Chrome/Edge, or serve over HTTPS).
- Simulated EEG toggle for hardware-free testing.
- Volume slider, "EEG mode" indicator showing last EEG flap latency.
- Settings persist in localStorage; pairing persists in the browser profile (Web Serial grants), reconnect is automatic.

## 8. Extras

- Menu shows top-10 table with EEG-sourced scores badged with a brain icon.
- `npm start` runs everything. `npm run dev` adds auto-restart via node --watch.
- README: wiring note (any 5 V USB-C Arduino), how to flash the reference sketch, browser requirements (Chrome/Edge; HTTPS or localhost for Web Serial), accepting the self-signed cert warning, troubleshooting (port grabbed by another tab — Web Serial allows only one reader at a time).

## 9. Build order

1. **M1 — Playable:** server skeleton + canvas game + spacebar + pipes + score + death. (No audio yet.)
2. **M2 — Arcade feel:** WebAudio SFX/music, particles, screen shake, parallax, neon rendering.
3. **M3 — Persistence:** score entry + top-10 API + menu table.
4. **M4 — Serial:** Web Serial pairing + connect UI, read loop + line parser, flap → in-game jump, strength meter, `eegsim.js` simulation mode.
5. **M5 — EEG hardening:** debounce, latency display, auto-reconnect, disconnect fallback, reference Arduino sketch, HTTPS cert bootstrapping + README.

M1–M3 are fully testable with spacebar; M4 verifies the full EEG pipeline in simulation mode before real hardware arrives.
