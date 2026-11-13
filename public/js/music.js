// Song composer: builds a deterministic, seeded synthwave loop as plain note
// events. Pure data — no WebAudio — so arrangements are unit-testable. The
// audio.js scheduler is the only consumer.
//
// Structure: 4 x 8-bar sections (intro / build / full / full-variant) over the
// classic minor progression i-VI-III-VII. Each bar: driving 8th-note bass,
// 16th arpeggio figure, backbeat hats/snare from bar 4 on, and a sparse
// pentatonic lead once the intro has breathed.
import { mulberry32 } from './rng.js';

export const BPM = 112;
export const STEPS_PER_BAR = 16; // 16th-note grid
const STEPS_PER_BEAT = 4;

export const SECTIONS = ['intro', 'build', 'full', 'full-variant'];
export const LOOP_BARS = SECTIONS.length * 8;

// A minor: i Am, VI F, III C, VII G. Chord tones are MIDI notes.
const PROGRESSION = [
  { root: 45, tones: [57, 60, 64] }, // Am
  { root: 41, tones: [53, 57, 60] }, // F
  { root: 48, tones: [52, 55, 59] }, // C (voiced low for bass swaps)
  { root: 43, tones: [55, 59, 62] }, // G
];
const PENTA = [69, 72, 74, 76, 79, 81, 84]; // A minor pentatonic, A4..C6

export function midiToFreq(m) {
  return 440 * 2 ** ((m - 69) / 12);
}

// 16th-note arpeggio shapes; index by step, cycle through chord tones.
const ARP_SHAPES = [
  [0, 1, 2, 1],
  [0, 2, 1, 2],
  [0, 1, 2, 0],
  [2, 1, 0, 1],
];

function eventsForBar(bar, rng) {
  const chord = PROGRESSION[bar % PROGRESSION.length];
  const section = SECTIONS[Math.floor(bar / 8)];
  const out = [];
  const put = (t, kind, midi, dur, gain) =>
    out.push({ t, kind, freq: midiToFreq(midi), dur, gain });

  // bass: steady 8ths, octave lift on the last 8th for drive
  for (let s = 0; s < STEPS_PER_BAR; s += 2) {
    const lift = s === 14 && section !== 'intro' ? 12 : 0;
    put(bar * 4 + s / STEPS_PER_BEAT, 'bass', chord.root + lift, 0.45, 0.13); // dur in beats
  }

  // arpeggio: absent in the intro's first half, then the engine of the track
  if (bar % 8 >= 4 || section !== 'intro') {
    const shape = ARP_SHAPES[(bar + Math.floor(rng() * 2)) % ARP_SHAPES.length];
    for (let s = 0; s < STEPS_PER_BAR; s++) {
      const tone = chord.tones[shape[s % shape.length]] + (s % 8 >= 4 ? 12 : 0);
      put(bar * 4 + s / STEPS_PER_BEAT, 'arp', tone, 0.22, 0.05); // dur in beats
    }
  }

  // drums: hats enter at bar 4, snare on 2 and 4 once the build arrives.
  // dur is beats for every kind, keeping the scheduler unit-consistent.
  if (bar >= 4) {
    for (const s of [2, 6, 10, 14]) out.push({ t: bar * 4 + s / STEPS_PER_BEAT, kind: 'hat', dur: 0.05, gain: 0.05 });
    if (bar >= 8) {
      for (const s of [4, 12]) out.push({ t: bar * 4 + s / STEPS_PER_BEAT, kind: 'snare', dur: 0.25, gain: 0.12 });
    }
  }

  // lead: sparse pentatonic phrases, two notes per active bar, phrase-aware
  if (bar >= 8) {
    const n = section === 'build' || rng() < 0.3 ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const s = 2 + Math.floor(rng() * 6) * 2 + i * 6; // on-beat-ish slots
      if (s >= STEPS_PER_BAR) continue;
      const note = PENTA[Math.floor(rng() * PENTA.length)];
      put(bar * 4 + s / STEPS_PER_BEAT, 'lead', note, (1 + Math.floor(rng() * 3)) / STEPS_PER_BEAT, 0.1);
    }
  }
  return out;
}

export function buildSong(seed = 1) {
  const rng = mulberry32(seed >>> 0);
  let events = [];
  for (let bar = 0; bar < LOOP_BARS; bar++) events.push(...eventsForBar(bar, rng));
  events.sort((a, b) => a.t - b.t || a.kind.localeCompare(b.kind));
  return {
    bpm: BPM,
    loopBeats: LOOP_BARS * 4,
    loopBars: LOOP_BARS,
    sections: SECTIONS.map((name, i) => ({ name, startBar: i * 8 })),
    events,
  };
}
