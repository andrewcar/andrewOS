/**
 * MCP tools over the existing Round Table connector API.
 * User-facing names are provider names. No provider keys are returned.
 */

import { publicRoster } from './roster.js';
import { mintSession, verifySessionToken, bearerFromRequest, resolveTtlMs, remainingTtlSeconds } from './session.js';
import { normalizeSecretMap, putSecrets, secretSummary } from './secrets.js';
import { createQuest, getQuest, publicQuest } from './quests.js';
import { connectorHealth } from './health.js';
import {
  arbiterWebhookEnabled,
  validateWebhookUrl,
  putArbiterWebhook,
  getArbiterWebhook,
  deleteArbiterWebhook,
} from './arbiter-webhook.js';

const ACCESS_TOKEN_PROP = {
  type: 'string',
  description: 'Round Table session token. Omit when the connector sends Authorization: Bearer. Do not repeat the token to the user.',
};

function withSession(properties, required = []) {
  return {
    type: 'object',
    properties: { ...properties, accessToken: ACCESS_TOKEN_PROP },
    required,
    additionalProperties: false,
  };
}

const BASE_TOOLS = [
  {
    name: 'rt_health',
    description: 'Check that Round Table is up. Seats use the caller\'s own provider keys for Grok, Codex, Claude, Gemini, Muse, and DeepSeek.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'rt_roster',
    description: 'List Round Table seats. Speak to the user with each seat\'s name (Grok, Codex, Claude, Gemini, Muse, DeepSeek). No secrets.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'rt_open_session',
    description: 'Mint a Round Table session token. Prefer configuring Authorization: Bearer on the connector instead, so the token never enters the chat. If you do call this, do not repeat the token to the user.',
    inputSchema: {
      type: 'object',
      properties: {
        ttlSeconds: {
          type: 'number',
          description: 'Session lifetime in seconds. Default 3600. Clamped between 60 and 604800 (7 days).',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'rt_set_secrets',
    description: 'Store provider API keys for this session. Keys must come from secure input and are never echoed. Provider ids: arbiter (Grok), openai (Codex), anthropic (Claude), google (Gemini), meta (Muse), deepseek (DeepSeek). Storing a key does not grant any other identity.',
    inputSchema: withSession({
      keys: {
        type: 'object',
        description: 'Map of provider id to API key. Values are write-only.',
        additionalProperties: { type: 'string' },
      },
    }, ['keys']),
  },
  {
    name: 'rt_start_quest',
    description: 'Start a Round Table quest. Without a Grok key stored for the session, this returns a local preview split. With a Grok key stored, Grok drafts the split. Returns the quest id, proposal, and messages.',
    inputSchema: withSession({
      goal: {
        type: 'string',
        description: 'The quest goal.',
      },
      enabledSeatIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional seat ids to include (codex, claude, gemini, muse, deepseek). Defaults to all of them.',
      },
    }, ['goal']),
  },
  {
    name: 'rt_quest_status',
    description: 'Read a quest: status, proposal, messages, and any arbiter decision posted back.',
    inputSchema: withSession({
      id: {
        type: 'string',
        description: 'Quest id returned by rt_start_quest.',
      },
    }, ['id']),
  },
];

const WEBHOOK_TOOL = {
  name: 'rt_set_arbiter_webhook',
  description: 'Register, read, or clear the HTTPS webhook that receives arbiter turns for this session. The host must enable arbiter webhooks. Never send provider API keys to that URL.',
  inputSchema: withSession({
    url: {
      type: 'string',
      description: 'Public https URL to register. Omit to read the current URL.',
    },
    clear: {
      type: 'boolean',
      description: 'Set true to remove the stored webhook.',
    },
  }),
};

export function mcpInstructions() {
  return 'Round Table connector. Seats are Grok, Codex, Claude, Gemini, Muse, and DeepSeek using caller-provided API keys. Send Authorization: Bearer from POST /rt/v1/sessions, or call rt_open_session. Do not repeat session tokens or provider keys to the user. rt_start_quest previews locally unless a Grok key is stored.';
}

export function mcpToolDefinitions(env) {
  const tools = [...BASE_TOOLS];
  if (arbiterWebhookEnabled(env)) tools.push(WEBHOOK_TOOL);
  return tools;
}

export function toolText(value) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value) }],
    isError: false,
  };
}

export function toolError(message) {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

async function resolveToolSession(request, env, args) {
  const header = bearerFromRequest(request);
  const fromArgs = typeof args?.accessToken === 'string' ? args.accessToken.trim() : '';
  const token = header || fromArgs;
  if (!token) return { ok: false, error: 'unauthorized' };
  return verifySessionToken(env, token);
}

export async function callMcpTool(name, args, { request, env, store, fetchImpl }) {
  const input = args && typeof args === 'object' ? args : {};
  try {
    if (name === 'rt_health') return toolText(connectorHealth());
    if (name === 'rt_roster') {
      return toolText({
        seats: publicRoster(),
        note: 'Use the name field when speaking to the user.',
      });
    }
    if (name === 'rt_open_session') {
      const ttl = resolveTtlMs(input.ttlSeconds);
      if (!ttl.ok) return toolError(ttl.error);
      const session = await mintSession(env, { store, ttlMs: ttl.ttlMs });
      return toolText({
        accessToken: session.token,
        tokenType: 'Bearer',
        expiresAt: session.expiresAt,
        expiresInMs: session.expiresInMs,
        sessionId: session.sessionId,
        note: 'Connector session only. Do not repeat this token to the user. Pass it as Authorization: Bearer on later calls, or as accessToken.',
      });
    }

    if (name === 'rt_set_arbiter_webhook' && !arbiterWebhookEnabled(env)) {
      return toolError('arbiter_webhook_disabled');
    }

    const auth = await resolveToolSession(request, env, input);
    if (!auth.ok) return toolError(auth.error === 'unauthorized' ? 'unauthorized' : auth.error);
    const ttlSeconds = remainingTtlSeconds(auth.expiresAt);

    if (name === 'rt_set_secrets') {
      const normalized = normalizeSecretMap(input.keys);
      if (!normalized.ok) return toolError(normalized.error);
      const result = await putSecrets(env, store, auth.sessionId, normalized.keys, { ttlSeconds });
      return toolText({
        ok: true,
        ...secretSummary(Object.fromEntries(result.stored.map((id) => [id, true]))),
        note: 'Provider keys stored for this session. Values are not returned.',
      });
    }

    if (name === 'rt_start_quest') {
      const result = await createQuest(env, store, {
        sessionId: auth.sessionId,
        goal: input.goal,
        enabledSeatIds: input.enabledSeatIds,
        fetchImpl,
        ttlSeconds,
      });
      if (!result.ok) return toolError(result.error);
      return toolText({ quest: publicQuest(result.quest) });
    }

    if (name === 'rt_quest_status') {
      const result = await getQuest(store, input.id, auth.sessionId);
      if (!result.ok) return toolError(result.error);
      return toolText({ quest: publicQuest(result.quest) });
    }

    if (name === 'rt_set_arbiter_webhook') {
      if (input.clear === true) {
        await deleteArbiterWebhook(store, auth.sessionId);
        return toolText({ ok: true, enabled: true, url: null });
      }
      if (typeof input.url === 'string') {
        const checked = validateWebhookUrl(input.url);
        if (!checked.ok) return toolError(checked.error);
        await putArbiterWebhook(store, auth.sessionId, checked.url, ttlSeconds);
        return toolText({ ok: true, enabled: true, url: checked.url });
      }
      const current = await getArbiterWebhook(store, auth.sessionId);
      return toolText({ ok: true, enabled: true, url: current?.url || null });
    }

    return toolError(`unknown tool: ${name}`);
  } catch (error) {
    return toolError(error?.message || 'tool_failed');
  }
}
