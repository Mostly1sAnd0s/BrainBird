// EEG serial protocol: ASCII lines "F:<confidence>" (flap intent) and "S:<value>"
// (signal strength). Pure parsing + debouncing, shared by the Web Serial reader,
// the simulator, and the unit tests.

export function parseLine(line) {
  const s = String(line).trim();
  let m = /^F:([\d.]+)$/.exec(s);
  if (m) return { type: 'flap', confidence: Number(m[1]) };
  m = /^S:([\d.]+)$/.exec(s);
  if (m) return { type: 'strength', value: Number(m[1]) };
  return null;
}

// Splits an arbitrarily chunked byte-stream text into complete lines (\n or \r\n).
export function createLineSplitter() {
  let buf = '';
  return {
    push(chunk) {
      buf += chunk;
      // A trailing lone \r is held back: the next char decides \r\n vs lone-\r.
      const hold = buf.endsWith('\r');
      const parts = (hold ? buf.slice(0, -1) : buf).split(/\r\n|\r|\n/);
      buf = parts.pop() + (hold ? '\r' : '');
      return parts;
    },
    flush() {
      if (!buf) return [];
      const rest = [buf];
      buf = '';
      return rest;
    },
  };
}

// User-tunable "cognitive jump point": the minimum confidence an F: event must
// carry to count as a flap. The threshold is read through a getter so the user
// can move the slider mid-flight and the next event already obeys it.
export function createConfidenceGate(getThreshold) {
  return (confidence) => confidence >= getThreshold();
}

// Returns a predicate: call with Date.now(); true only when the flap is allowed.
export function createDebouncer(minMs) {
  let last = -Infinity;
  return (now) => {
    if (now - last >= minMs) {
      last = now;
      return true;
    }
    return false;
  };
}
