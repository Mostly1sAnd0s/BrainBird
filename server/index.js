// BrainBird server: static game host + shared high-score API.
// Production entrypoint binds HTTPS on all interfaces (Web Serial needs a secure
// context on LAN clients) plus plain HTTP on localhost for quick testing.
// Tests import createApp() and listen on ephemeral HTTP ports only.
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import https from 'node:https';
import selfsigned from 'selfsigned';
import { fileURLToPath } from 'node:url';
import { createScoreStore } from './scores.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.join(HERE, '..');

export function createApp({ scoreFile = path.join(ROOT, 'data', 'scores.json'), publicDir = path.join(ROOT, 'public') }) {
  const app = express();
  const store = createScoreStore(scoreFile);
  app.disable('x-powered-by');

  app.get('/api/scores', (req, res) => res.json({ scores: store.top() }));

  app.post('/api/scores', express.json({ limit: '2kb' }), (req, res) => {
    try {
      res.json(store.submit(req.body ?? {}));
    } catch (err) {
      res.status(400).json({ error: String(err.message) });
    }
  });

  // API misses answer JSON; everything else falls through to the SPA.
  app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));
  app.use(express.static(publicDir, { extensions: ['html'] }));
  return app;
}

function lanUrls(port, secure) {
  const urls = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) urls.push(`${secure ? 'https' : 'http'}://${a.address}:${port}`);
    }
  }
  return urls;
}

function getCert(certDir) {
  const keyFile = path.join(certDir, 'key.pem');
  const certPathFile = path.join(certDir, 'cert.pem');
  if (fs.existsSync(keyFile) && fs.existsSync(certPathFile)) {
    return { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certPathFile) };
  }
  const pairs = selfsigned.generate([{ name: 'commonName', value: 'brainbird.local' }], {
    days: 825, keySize: Number(process.env.CERT_KEY_SIZE || 2048), algorithm: 'sha256',
  });
  fs.mkdirSync(certDir, { recursive: true });
  fs.writeFileSync(keyFile, pairs.private);
  fs.writeFileSync(certPathFile, pairs.cert);
  console.log('Generated a new self-signed certificate in certs/');
  return { key: pairs.private, cert: pairs.cert };
}

const HTTPS_PORT = Number(process.env.PORT || 8443);
const HTTP_PORT = Number(process.env.HTTP_PORT || 8788);

function listen(server, port, host, label) {
  server.on('error', (err) => {
    console.warn(`[brainbird] ${label} could not bind ${host}:${port} (${err.code}). Override with PORT/HTTP_PORT.`);
  });
  server.listen(port, host, () => console.log(`${label} → ${host === '0.0.0.0' ? '0.0.0.0' : host}:${port}`));
}

function boot() {
  const app = createApp({});
  const { key, cert } = getCert(path.join(ROOT, 'certs'));
  listen(https.createServer({ key, cert }, app), HTTPS_PORT, '0.0.0.0', 'BrainBird HTTPS (EEG works): https://localhost:' + HTTPS_PORT);
  listen(http.createServer(app), HTTP_PORT, '127.0.0.1', 'BrainBird HTTP (localhost, no EEG): http://localhost:' + HTTP_PORT);
  for (const u of lanUrls(HTTPS_PORT, true)) console.log(`  LAN: ${u}  (accept the cert warning once)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) boot();
