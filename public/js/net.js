// Thin fetch wrapper for the BrainBird score API.
const JSON_HEADERS = { 'content-type': 'application/json' };

export async function fetchHighScores() {
  const res = await fetch('/api/scores');
  if (!res.ok) throw new Error(`scores GET ${res.status}`);
  return (await res.json()).scores;
}

export async function submitScore({ name, score, source }) {
  const res = await fetch('/api/scores', {
    method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ name, score, source }),
  });
  if (!res.ok) throw new Error(`scores POST ${res.status}`);
  return res.json(); // { rank, board }
}
