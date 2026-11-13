# BrainBird Arduino firmware

The reference sketch turns an Arduino into a flap-intent transmitter.
It does all detection on-device; the browser only parses two line types.

## Wire protocol

115200 baud, ASCII, one item per line (terminated `\r\n` or `\n`):

| Line | Meaning |
|------|---------|
| `S:<value>` | signal strength, integer 0-1024, sent at ~10 Hz |
| `F:<confidence>` | flap intent, confidence 0.00-1.00, at most one per 250 ms |

Anything else on the wire is ignored by the client, so debug prints are safe.

## Wiring

One analog wire from your EEG front-end's envelope output to `A0`, plus GND.
Known-good inputs:

- Grove Human ThinkWave (analog wave out)
- Any EEG/EMG board exposing an analog envelope
- A potentiometer for rehearsals: twisting it quickly fires flaps

The Arduino powers from USB. No level-shifting needed for analog-in boards.

## Flashing

1. Open `brainbird_eeg/brainbird_eeg.ino` in the Arduino IDE.
2. Select your board and the device's COM/tty port.
3. Upload. Keep the Serial Monitor open at 115200 baud.

On power-up the sketch prints a banner, then spends 3 s capturing your resting
baseline. Wear the device and stay still during calibration.

## Tuning

All knobs are constants at the top of the sketch:

- `TRIGGER_SIGMA` (default 2.5): raise until resting flaps stop, lower until a
  deliberate focus attempt crosses the threshold. This is the main knob.
- `REFRACTORY_US` (250): device-side debounce. The client debounces again at
  the same rate; keep both values matched.
- `CALIB_MS` (3000): baseline capture window.
- `SAMPLE_US` (4000): sampling period, 250 Hz.

The detector is baseline + exponential-moving-average sigma, so it adapts to
slow drift in electrode contact after calibration.

## No board on hand?

- In the browser: Settings → Simulation mode drives the same pipeline with
  synthetic events.
- On a real UART (bench loopback, second board):
  `python3 simulate_serial.py /dev/ttyUSB1 --flaps 20` (or `--dry` to stdout)
  (`pip install pyserial`). Chrome's Web Serial only lists true USB-serial
  devices, so this is for wired bench tests, not the browser picker.

## Protocol contract

`public/js/eegconformance.test.js` pins every line format this sketch can emit
against the client parser. If you change the printf formats, that test fails
until the parser matches. Run `npm test` after edits.
