/**
 * Streamable HTTP MCP endpoint (stateless).
 * POST JSON-RPC to /rt/v1/mcp or /mcp. GET/DELETE return 405 (no SSE session).
 */

import { json, accepted, readJson } from './http.js';
import { mcpInstructions, mcpToolDefinitions, callMcpTool } from './mcp-tools.js';
import { createMemoryStore, createKvStore } from './store.js';

export const MCP_PATHS = ['/rt/v1/mcp', '/mcp'];
export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-03-26', '2025-06-18'];
export const DEFAULT_PROTOCOL_VERSION = '2025-06-18';

export function isMcpPath(pathname) {
  return MCP_PATHS.includes(pathname);
}

function getStore(env) {
  if (env?.__store) return env.__store;
  if (env?.RT_KV) return createKvStore(env.RT_KV);
  if (!env.__fallbackStore) env.__fallbackStore = createMemoryStore();
  return env.__fallbackStore;
}

export function originAllowed(request) {
  const origin = request.headers.get('origin');
  if (!origin || origin === 'null') return true;
  let originUrl;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }
  const host = new URL(request.url).hostname;
  const local = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (!local) return true;
  const originHost = originUrl.hostname;
  return originHost === 'localhost' || originHost === '127.0.0.1' || originHost === '::1';
}

export function acceptHeaderOk(header) {
  if (!header) return false;
  const value = header.toLowerCase();
  if (value.includes('*/*')) return true;
  return value.includes('application/json') || value.includes('text/event-stream');
}

function rpcError(id, code, message, status = 200) {
  return json(status, {
    jsonrpc: '2.0',
    id: id ?? null,
    error: { code, message },
  });
}

function rpcResult(id, result) {
  return json(200, { jsonrpc: '2.0', id, result });
}

function negotiateVersion(requested) {
  if (SUPPORTED_PROTOCOL_VERSIONS.includes(requested)) return requested;
  return DEFAULT_PROTOCOL_VERSION;
}

async function dispatch(message, request, env, deps) {
  const id = Object.prototype.hasOwnProperty.call(message, 'id') ? message.id : undefined;
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return rpcError(id ?? null, -32600, 'Invalid Request', 400);
  }
  const isNotification = !Object.prototype.hasOwnProperty.call(message, 'id');
  if (isNotification || message.method.startsWith('notifications/')) {
    return accepted();
  }

  if (message.method === 'initialize') {
    const requested = message.params?.protocolVersion;
    return rpcResult(message.id, {
      protocolVersion: negotiateVersion(requested),
      capabilities: { tools: { listChanged: false } },
      serverInfo: {
        name: 'round-table',
        title: 'Round Table',
        version: '1.1.0',
      },
      instructions: mcpInstructions(),
    });
  }

  if (message.method === 'ping') return rpcResult(message.id, {});

  if (message.method === 'tools/list') {
    return rpcResult(message.id, { tools: mcpToolDefinitions(env) });
  }

  if (message.method === 'tools/call') {
    const name = message.params?.name;
    if (!name || typeof name !== 'string') {
      return rpcError(message.id, -32602, 'Invalid params');
    }
    const result = await callMcpTool(name, message.params?.arguments, {
      request,
      env,
      store: getStore(env),
      fetchImpl: deps.fetchImpl || globalThis.fetch,
    });
    return rpcResult(message.id, result);
  }

  return rpcError(message.id, -32601, `Method not found: ${message.method}`);
}

export async function handleMcp(request, env, deps = {}) {
  if (!originAllowed(request)) {
    return json(403, { error: 'origin_not_allowed' });
  }

  if (request.method === 'GET' || request.method === 'DELETE') {
    return json(405, {
      error: 'method_not_allowed',
      transport: 'streamable-http',
      hint: 'POST a single JSON-RPC message. This server does not open an SSE stream.',
    }, { allow: 'POST' });
  }

  if (request.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' }, { allow: 'POST' });
  }

  const protocol = request.headers.get('mcp-protocol-version');
  if (protocol && !SUPPORTED_PROTOCOL_VERSIONS.includes(protocol)) {
    return json(400, {
      error: 'unsupported_protocol_version',
      supported: SUPPORTED_PROTOCOL_VERSIONS,
    });
  }

  if (!acceptHeaderOk(request.headers.get('accept'))) {
    return json(406, {
      error: 'not_acceptable',
      hint: 'Send Accept: application/json, text/event-stream',
    });
  }

  let message;
  try {
    message = await readJson(request);
  } catch {
    return rpcError(null, -32700, 'Parse error', 400);
  }
  if (Array.isArray(message)) {
    return json(400, { error: 'batch_not_supported' });
  }
  return dispatch(message, request, env, deps);
}
