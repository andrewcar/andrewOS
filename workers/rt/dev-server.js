#!/usr/bin/env node
/**
 * Local Node HTTP server for the Round Table connector (no Wrangler required).
 *
 *   RT_SESSION_SECRET=dev-secret-at-least-16-chars npm run rt:dev
 *
 * Hits: GET http://127.0.0.1:8787/rt/v1/health
 */

import http from 'node:http';
import { handleRequest } from './src/router.js';
import { createMemoryStore } from './src/store.js';

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';

const env = {
  RT_SESSION_SECRET: process.env.RT_SESSION_SECRET || 'local-dev-session-secret-change-me',
  __store: createMemoryStore(),
};

function toWebRequest(req, bodyBuf) {
  const host = req.headers.host || `${HOST}:${PORT}`;
  const url = `http://${host}${req.url}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
  }
  const init = { method: req.method, headers };
  if (bodyBuf && bodyBuf.length && req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = bodyBuf;
  }
  return new Request(url, init);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

const server = http.createServer(async (req, res) => {
  try {
    const bodyBuf = await readBody(req);
    const request = toWebRequest(req, bodyBuf);
    const response = await handleRequest(request, env);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    const buf = Buffer.from(await response.arrayBuffer());
    res.end(buf);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: error.message || 'internal_error' }));
  }
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Round Table connector listening on http://${HOST}:${PORT}/rt/v1/health`);
  // eslint-disable-next-line no-console
  console.log(`RT_SESSION_SECRET length: ${env.RT_SESSION_SECRET.length}`);
});
