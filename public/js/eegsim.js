// Simulated EEG stream for hardware-free testing. Emits the same F:/S: events
// the Arduino would, through the same handler contract as serial.js.

export function createEegSim(onEvent) {
  let timer = null;
  return {
    get running() { return timer !== null; },
    start() {
      if (timer) return;
      timer = setInterval(() => {
        // wandering signal strength, occasional flap intents every 0.9-1.8 s
        onEvent({ type: 'strength', value: Math.round(300 + 250 * Math.random()) }, Date.now());
        if (Math.random() < 0.035) onEvent({ type: 'flap', confidence: 0.6 + Math.random() * 0.4 }, Date.now());
      }, 120);
    },
    stop() {
      clearInterval(timer);
      timer = null;
    },
  };
}
