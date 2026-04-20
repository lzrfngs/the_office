/**
 * Local dev API server for The Grove.
 * Proxies /api/chat requests so the Phaser frontend works during development.
 * In production, Vercel handles /api/* natively.
 *
 * Run: node server.js
 * Reads .env for LLM provider config.
 */

import { createServer } from 'http';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env file
function loadEnv() {
  try {
    const envPath = resolve(__dirname, '.env');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.substring(0, eqIdx).trim();
      let value = trimmed.substring(eqIdx + 1).trim();
      // Strip surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    console.log('No .env file found — using fallback responses.');
  }
}

loadEnv();

// Dynamically import the handlers (ESM)
const { default: chatHandler } = await import('./api/chat.js');
const { default: thinkHandler } = await import('./api/think.js');

const PORT = 3001;

const server = createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/api/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body);
        // Simulate Express-like req/res for the Vercel handler
        const fakeReq = { method: 'POST', body: parsed };
        const fakeRes = {
          statusCode: 200,
          headers: {},
          setHeader(k, v) { this.headers[k] = v; },
          status(code) { this.statusCode = code; return this; },
          json(data) {
            res.writeHead(this.statusCode, {
              'Content-Type': 'application/json',
              ...this.headers
            });
            res.end(JSON.stringify(data));
          },
          end() { res.writeHead(this.statusCode); res.end(); }
        };
        await chatHandler(fakeReq, fakeRes);
      } catch (err) {
        console.error('Handler error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });
  } else if (req.url === '/api/think' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body);
        const fakeReq = { method: 'POST', body: parsed };
        const fakeRes = {
          statusCode: 200,
          headers: {},
          setHeader(k, v) { this.headers[k] = v; },
          status(code) { this.statusCode = code; return this; },
          json(data) {
            res.writeHead(this.statusCode, {
              'Content-Type': 'application/json',
              ...this.headers
            });
            res.end(JSON.stringify(data));
          },
          end() { res.writeHead(this.statusCode); res.end(); }
        };
        await thinkHandler(fakeReq, fakeRes);
      } catch (err) {
        console.error('Think handler error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`Grove API server running on http://localhost:${PORT}`);
  console.log(`LLM provider: ${process.env.LLM_PROVIDER || 'none (using fallbacks)'}`);
});
