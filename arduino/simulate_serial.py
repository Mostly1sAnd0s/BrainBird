#!/usr/bin/env python3
"""BrainBird device simulator.

Emits the exact wire format brainbird_eeg.ino produces, onto a real serial
device or file. Use it when the EEG front-end is not wired up:

    python3 simulate_serial.py /dev/ttyUSB1            # feed a device/loopback
    python3 simulate_serial.py --seed 7 --flaps 20 out.log

Note: Chrome's Web Serial only lists genuine USB-serial devices, so a PTY
will not appear in the browser picker. For browser testing without hardware
use the in-game Simulation mode (public/js/eegsim.js). This script exists to
exercise the firmware's wire format against real UARTs and to script bench
tests (see --flaps/--period).
"""
import argparse
import random
import sys
import time


def frames(seed: int, n_flaps: int, period_s: float):
    """Yield protocol lines mirroring the firmware: S at 10 Hz, F on trigger."""
    rng = random.Random(seed)
    t = 0.0
    next_flap_at = rng.uniform(0.5, 1.5)
    emitted_flaps = 0
    while emitted_flaps < n_flaps:
        strength = max(0, min(1024, int(rng.gauss(512, 40))))
        yield f"S:{strength}\r\n", t
        if t >= next_flap_at:
            conf = round(min(1.0, rng.uniform(0.5, 0.9)), 2)
            yield f"F:{conf:.2f}\r\n", t
            emitted_flaps += 1
            next_flap_at = t + period_s * rng.uniform(0.8, 1.2)
        t += 0.1  # 10 Hz


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("port", nargs="?", help="serial device or file to write")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--flaps", type=int, default=10, help="number of flap events")
    ap.add_argument("--period", type=float, default=1.5, help="avg seconds between flaps")
    ap.add_argument("--dry", action="store_true", help="print frames instead of writing")
    args = ap.parse_args()

    if args.dry or args.port is None:
        for line, _ in frames(args.seed, args.flaps, args.period):
            sys.stdout.write(line)
        return 0

    import serial  # pyserial, only needed for real devices
    with serial.Serial(args.port, 115200, timeout=1) as ser:
        for line, ts in frames(args.seed, args.flaps, args.period):
            ser.write(line.encode())
            time.sleep(0.1)
    print(f"sent {args.flaps} flaps to {args.port}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
