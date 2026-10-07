/**
 * Quest create + status. Slice 1: preview arbiter split locally,
 * or live arbiter via proxy when an `arbiter` key is present.
 */

import { randomId } from './crypto-util.js';
import { knights, seatById, CONNECTOR_ROSTER } from './roster.js';
import { getSecrets } from './secrets.js';
import { buildProposal } from './split.js';
import { proxyChat } from './proxy.js';
import { questKey } from './store.js';

function parseLiveProposal(text, { id, revision, knightsOn }) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  let json;
  try {
    json = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (!Array.isArray(json.allocations)) return null;
  const allowed = new Set(knightsOn.map((seat) => seat.id));
  const allocations = json.allocations
    .filter((row) => allowed.has(row.seatId))
    .map((row) => ({
      seatId: row.seatId,
      percent: Math.max(0, Math.round(Number(row.percent) || 0)),
      responsibility: String(row.responsibility || 'Review & integration').slice(0, 80),
    }));
  const sum = allocations.reduce((total, row) => total + row.percent, 0);
  if (!allocations.length || sum < 90 || sum > 110) return null;
  return {
    id,
    revision,
    pattern: 'percent-split',
    source: 'live',
    approach: String(json.approach || 'Provider split').slice(0, 240),
    allocations,
    superseded: false,
  };
}

function resolveKnights(enabledSeatIds) {
  const all = knights(CONNECTOR_ROSTER);
  if (!Array.isArray(enabledSeatIds) || enabledSeatIds.length === 0) return all;
  const wanted = new Set(enabledSeatIds);
  const picked = all.filter((seat) => wanted.has(seat.id));
  return picked.length ? picked : all;
}

export async function createQuest(env, store, {
  sessionId,
  goal,
  enabledSeatIds,
  fetchImpl = globalThis.fetch,
  now = () => new Date().toISOString(),
} = {}) {
  const prompt = String(goal || '').trim();
  if (!prompt) {
    return { ok: false, status: 400, error: 'goal is required' };
  }
  const knightsOn = resolveKnights(enabledSeatIds);
  const questId = randomId('quest');
  const createdAt = typeof now === 'function' ? now() : now;
  const messages = [
    {
      id: randomId('msg'),
      seatId: 'king',
      kind: 'quest',
      text: prompt,
      createdAt,
    },
  ];

  const secrets = await getSecrets(env, store, sessionId);
  let proposal = null;
  let source = 'preview';
  let note = null;

  if (secrets.arbiter) {
    const arbiter = seatById('botbot');
    const result = await proxyChat({
      providerId: 'arbiter',
      apiKey: secrets.arbiter,
      messages: [
        {
          role: 'system',
          content: `You are ${arbiter.name}, arbiter of the Round Table. Reply with JSON only: {"approach": string, "allocations": [{"seatId": string, "percent": number, "responsibility": string}]}. Percents must sum to 100. Only use the given seat ids.`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            prompt,
            seats: knightsOn.map((seat) => seat.id),
          }),
        },
      ],
      fetchImpl,
    });
    if (result.ok) {
      proposal = parseLiveProposal(result.text, {
        id: randomId('prop'),
        revision: 1,
        knightsOn,
      });
      if (proposal) {
        source = 'live';
        messages.push({
          id: randomId('msg'),
          seatId: 'botbot',
          kind: 'status',
          text: `${arbiter.name} drafted a live split.`,
          createdAt: typeof now === 'function' ? now() : now,
        });
      } else {
        note = `${arbiter.name} reply was not usable; fell back to local preview.`;
      }
    } else {
      note = `${arbiter.name} could not draft live (${result.error}). Fell back to local preview.`;
    }
  }

  if (!proposal) {
    proposal = buildProposal({
      prompt,
      knights: knightsOn,
      revision: 1,
      id: randomId('prop'),
      source: 'preview',
    });
    source = 'preview';
    messages.push({
      id: randomId('msg'),
      seatId: 'botbot',
      kind: 'status',
      text: note || 'Local preview split drafted (no arbiter key or live draft unavailable).',
      createdAt: typeof now === 'function' ? now() : now,
    });
  }

  const quest = {
    id: questId,
    sessionId,
    goal: prompt,
    status: 'proposed',
    source,
    enabledSeatIds: knightsOn.map((s) => s.id),
    proposal,
    messages,
    createdAt,
    updatedAt: typeof now === 'function' ? now() : now,
  };

  await store.put(questKey(questId), JSON.stringify(quest), { expirationTtl: 3600 });
  return { ok: true, status: 201, quest };
}

export async function getQuest(store, questId, sessionId) {
  if (!questId) return { ok: false, status: 400, error: 'quest id required' };
  const raw = await store.get(questKey(questId));
  if (!raw) return { ok: false, status: 404, error: 'quest not found' };
  let quest;
  try {
    quest = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return { ok: false, status: 500, error: 'corrupt quest record' };
  }
  if (quest.sessionId !== sessionId) {
    return { ok: false, status: 404, error: 'quest not found' };
  }
  return { ok: true, status: 200, quest };
}

/** Public JSON shape for quest responses. */
export function publicQuest(quest) {
  return {
    id: quest.id,
    goal: quest.goal,
    status: quest.status,
    source: quest.source,
    enabledSeatIds: quest.enabledSeatIds,
    proposal: quest.proposal,
    messages: quest.messages,
    createdAt: quest.createdAt,
    updatedAt: quest.updatedAt,
  };
}
