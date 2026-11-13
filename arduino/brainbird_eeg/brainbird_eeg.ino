/*
  BrainBird EEG — reference firmware.

  Reads an analog sensor on ANALOG_PIN, decides on-device whether the user has
  produced a flap intent, and streams a tiny ASCII protocol over USB serial.
  The browser does no DSP: it only parses F: and S: lines.

  Protocol (115200 baud, Serial.println terminates with \r\n):
    S:<value>          signal strength, 0-1024, at ~10 Hz
    F:<confidence>     flap intent, confidence 0.00-1.00, at most one per REFRACTORY_US

  Hardware-agnostic by design. Point ANALOG_PIN at whatever your EEG front-end
  outputs. Tested signal sources:
    - Grove Human ThinkWave (analog wave out)
    - Any emg/eeg board with an analog envelope output
    - A potentiometer, to rehearse without a head (turn it fast to flap)

  Calibration: on power-up the sketch samples ANALOG_PIN for CALIB_MS and
  records the baseline mean and spread. It then fires a flap when the signal
  departs from baseline by more than TRIGGER_SIGMA standard deviations, and
  waits REFRACTORY_US before it can fire again.

  Tune in this order if flaps are unreliable:
    1. Open the Serial Monitor at 115200 and watch S: while wearing the device.
    2. Raise TRIGGER_SIGMA until random flaps stop at rest.
    3. Lower it until a deliberate focus attempt still crosses.
*/

#include <Arduino.h>

const int ANALOG_PIN     = A0;
const int BAUD           = 115200;

const unsigned long CALIB_MS       = 3000;     // baseline capture at power-up
const unsigned long SAMPLE_US      = 4000;     // 250 Hz sampling
const unsigned long STRENGTH_US    = 100000;   // S: line rate (10 Hz)
const unsigned long REFRACTORY_US  = 250000;   // device-side debounce, matches client
const float TRIGGER_SIGMA          = 2.5f;   // departures per std-dev that count

// Detector state: baseline from calibration, live spread tracked with an EMA.
float baseMean = 0.0f, baseVar = 1.0f;
float liveVar  = 1.0f;
unsigned long lastFlapAt = 0;
bool calibrated = false;

void setup() {
  Serial.begin(BAUD);
  pinMode(ANALOG_PIN, INPUT);
  Serial.println("BrainBird EEG v1 starting...");
  Serial.println("calibrating baseline (3s)");
  calibrate();
}

void calibrate() {
  unsigned long t0 = millis();
  double sum = 0, sumSq = 0;
  long n = 0;
  while (millis() - t0 < CALIB_MS) {
    float v = readSample();
    sum += v; sumSq += (double)v * v; n++;
    delayMicroseconds(SAMPLE_US);
  }
  if (n < 10) n = 10;                     // guard against a dead input
  baseMean = (float)(sum / n);
  baseVar  = (float)(sumSq / n - (double)baseMean * baseMean);
  if (baseVar < 1.0f) baseVar = 1.0f;     // never divide by a flat baseline
  liveVar  = baseVar;
  calibrated = true;
}

// Reads one sample with a small oversleep-and-average for noise rejection.
float readSample() {
  long acc = 0;
  for (int i = 0; i < 4; i++) acc += analogRead(ANALOG_PIN);
  return (float)acc / 4.0f;
}

void loop() {
  static unsigned long lastSample = 0, lastStrength = 0;
  if (!calibrated) return;

  // microsecond clock throughout: no millis()/micros() mixing, no truncation
  unsigned long now = micros();
  if (now - lastSample < SAMPLE_US) return;
  lastSample = now;

  float v = readSample();
  float deviation = fabsf(v - baseMean);

  // EMA of variance: adapts to slow drift in electrode contact.
  float inst = deviation * deviation;
  liveVar = 0.98f * liveVar + 0.02f * inst;
  float sigma = sqrtf(liveVar > baseVar ? liveVar : baseVar);

  // strength = deviation scaled into the 10-bit ADC range
  if (now - lastStrength >= STRENGTH_US) {
    lastStrength = now;
    int scaled = constrain((int)(deviation / sigma * 100.0f), 0, 1024);
    Serial.print("S:");
    Serial.println(scaled); // wire format == printf("S:%d\n")
  }

  if (now - lastFlapAt < REFRACTORY_US) return;
  if (deviation < TRIGGER_SIGMA * sigma) return;

  // Confidence grows with how far past the trigger the signal went, capped at 1.
  float overshoot = deviation / (TRIGGER_SIGMA * sigma) - 1.0f;
  float confidence = constrain(0.5f + 0.5f * overshoot, 0.5f, 1.0f);
  lastFlapAt = now;
  Serial.print("F:");
  Serial.print(confidence, 2); // 2 decimals == printf("%.2f")
  Serial.println();
}
