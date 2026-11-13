# 🧠 BrainBird

An original one-button arcade flying game you pilot with your brain.

Plug an Arduino-based EEG sensor into your computer and focus to flap. No headset? The spacebar works too. The game runs in your browser and is hosted locally, so anyone on your LAN can play and share one leaderboard.

## Features

- **EEG control** — the Arduino detects flap intent on-device and streams simple events over USB. The browser reads the device directly with the [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API).
- **Spacebar fallback** — always playable without hardware.
- **Neon synthwave visuals** — grid horizon, parallax city, glowing pipes, and a pixel brain with wings.
- **Synthesized audio** — all sounds are generated with WebAudio. EEG flaps get a distinct "psychic" chord so you can hear your brain working.
- **Procedural obstacles** — difficulty ramps with your score.
- **Shared high scores** — top 10 with names, stored on the server, EEG runs badged with a brain icon.
- **Settings page** — music/SFX toggles, volume, drop-speed slider (slow the fall for EEG play), jump-threshold slider (your "cognitive jump point"), device pairing and connection status, signal-strength meter.
- **Live tuning bar** — during play: signal strength, a marker showing your jump threshold, and a light that flashes FLAP / TOO SOFT / KEY so you can tune the threshold while flying. Press Esc anytime to return to the menu.

## Requirements

- Node.js 18+
- Chrome or Edge for EEG control (Web Serial is not available in Firefox or Safari). Spacebar play works in any browser.
- The game is served over HTTPS with a self-signed certificate, because Web Serial requires a secure context. Accept the certificate warning once per browser. `http://localhost` also works without a cert, but without Web Serial on other machines.

## Quick start

```bash
npm install
npm start
```

Then open one of the URLs printed in the terminal. LAN clients accept the certificate warning and load the game.

## Connecting the Arduino

1. Flash the reference sketch from `arduino/brainbird_eeg/`.
2. Plug the Arduino into **your own computer** (the one running the browser).
3. Open the game, go to **Settings → EEG**, click **Pair device**, and pick the Arduino from the browser's device picker.
4. Paired devices appear in the dropdown and reconnect automatically.

The device speaks a simple line protocol at 115200 baud:

| Line | Meaning |
|------|---------|
| `F:<confidence>` | Flap intent, already thresholded on-device |
| `S:<value>` | Signal strength sample for the UI meter |

No hardware yet? Enable **Simulation mode** in Settings to exercise the full EEG pipeline with synthetic events.

## Project layout

```
server/    Express static host + high-score API (HTTPS + localhost HTTP)
public/    Game client (vanilla JS + Canvas, no build step)
arduino/   Reference EEG sketch and protocol notes
data/      scores.json (gitignored)
```

See [PLAN.md](PLAN.md) for the full design and build milestones.

## Troubleshooting

- **No device picker / dropdown missing** — you are on `http://` from another machine. Use the HTTPS URL, or `http://localhost` on the host itself.
- **Port will not open** — only one browser tab can read a device at a time. Close the other tab or the Arduino IDE serial monitor.
- **Scoreboard empty** — scores live on the server; make sure the server is running when you submit.

## License

MIT — see [LICENSE](LICENSE).
