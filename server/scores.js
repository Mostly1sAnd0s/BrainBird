// High-score store. Top-10 board persisted as a JSON file, shared by all LAN players.
import fs from 'node:fs';

export const MAX_NAME = 16;
export const MAX_SCORE = 1_000_000;
export const BOARD_SIZE = 10;
export const SOURCES = ['eeg', 'keyboard', 'sim'];

export function validateEntry({ name, score, source = 'keyboard' } = {}) {
  if (typeof name !== 'string' || name.trim() === '') throw new Error('name required');
  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) throw new Error('score must be an integer in [0, MAX_SCORE]');
  if (!SOURCES.includes(source)) throw new Error(`source must be one of ${SOURCES.join(', ')}`);
  return { name: name.trim().slice(0, MAX_NAME), score, source, ts: Date.now() };
}

export function createScoreStore(filePath) {
  let entries = load();

  function load() {
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((e) => e && typeof e.name === 'string' && Number.isInteger(e.score))
        .map((e) => ({ name: e.name.slice(0, MAX_NAME), score: e.score, source: SOURCES.includes(e.source) ? e.source : 'keyboard', ts: e.ts || 0 }));
    } catch {
      return []; // missing or corrupt file: start fresh
    }
  }

  function save() {
    fs.mkdirSync(filePath.slice(0, filePath.lastIndexOf('/') + 1) || '.', { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(entries, null, 2));
  }

  return {
    top() {
      return [...entries].sort((a, b) => b.score - a.score).slice(0, BOARD_SIZE);
    },
    submit(input) {
      const entry = validateEntry(input);
      entries.push(entry);
      entries.sort((a, b) => b.score - a.score);
      entries = entries.slice(0, BOARD_SIZE);
      save();
      const rank = entries.indexOf(entry) + 1;
      return { rank: rank > 0 ? rank : null, board: this.top() };
    },
  };
}
