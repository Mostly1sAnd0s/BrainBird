// Web Serial EEG client. Pairs devices via the browser picker, reads lines,
// and emits {type:'flap'|'strength'} events to a handler. Chrome/Edge only.
import { parseLine, createLineSplitter } from './eeg.js';

const BAUD = 115200;

export function serialSupported() {
  return typeof navigator !== 'undefined' && !!navigator.serial;
}

export function createEegClient(onEvent, onStatus) {
  let port = null, reader = null, keepReading = false;

  function status(state, detail = '') {
    if (onStatus) onStatus(state, detail);
  }

  async function readLoop(p) {
    const splitter = createLineSplitter();
    const decoderStream = new TextDecoderStream();
    const stream = p.readable.pipeThrough(decoderStream);
    reader = stream.getReader();
    keepReading = true;
    try {
      while (keepReading) {
        const { value, done } = await reader.read();
        if (done) break;
        for (const line of splitter.push(value)) {
          const ev = parseLine(line);
          if (ev) onEvent(ev, Date.now());
        }
      }
    } catch {
      // read errors land as disconnect below
    } finally {
      if (port === p) {
        keepReading = false;
        port = null;
        status('disconnected');
      }
    }
  }

  async function connect(p) {
    try {
      await p.open({ baudRate: BAUD });
      port = p;
      status('connected');
      readLoop(p);
      return true;
    } catch (err) {
      status('error', String(err.message || err));
      return false;
    }
  }

  async function disconnect() {
    keepReading = false;
    const p = port;
    port = null;
    // Web Serial requires releasing the reader before port.close(): cancel, then
    // wait for the read promise to settle, or close() throws "stream still locked".
    try { await reader?.cancel(); } catch {}
    try { await reader?.closed; } catch {}
    reader = null;
    try { await p?.close(); } catch {}
    status('disconnected');
  }

  return {
    get port() { return port; },
    connect,
    disconnect,
    async pair() {
      if (!serialSupported()) throw new Error('Web Serial not available in this browser');
      const p = await navigator.serial.requestPort();
      await connect(p);
      return p;
    },
    async listPaired() {
      return serialSupported() ? navigator.serial.getPorts() : [];
    },
    // Auto-reconnect a remembered device on load (no user prompt needed).
    async autoConnect() {
      const ports = await this.listPaired();
      if (ports.length) return connect(ports[0]);
      return false;
    },
    watchHotplug() {
      if (!serialSupported()) return;
      navigator.serial.addEventListener('connect', async (e) => {
        const paired = await this.listPaired();
        if (!port && paired.includes(e.target)) connect(e.target); // auto-grab on plug-in
      });
      navigator.serial.addEventListener('disconnect', () => {
        if (port) { port = null; status('disconnected'); }
      });
    },
  };
}
