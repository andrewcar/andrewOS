/**
 * Connector-facing Round Table roster.
 * Public product display names only — not fleet / ___Bot identity.
 */

export const CONNECTOR_ROSTER = [
  {
    id: 'king',
    name: 'You',
    role: 'king',
    providerId: 'human',
    tagline: 'King',
    defaultEnabled: true,
  },
  {
    id: 'botbot',
    name: 'Grok (API)',
    role: 'arbiter',
    providerId: 'arbiter',
    tagline: 'xAI',
    defaultEnabled: true,
  },
  {
    id: 'codex',
    name: 'Codex',
    role: 'knight',
    providerId: 'openai',
    tagline: 'OpenAI',
    defaultEnabled: true,
  },
  {
    id: 'claude',
    name: 'Claude',
    role: 'knight',
    providerId: 'anthropic',
    tagline: 'Anthropic',
    defaultEnabled: true,
  },
  {
    id: 'gemini',
    name: 'Gemini',
    role: 'knight',
    providerId: 'google',
    tagline: 'Google Gemini',
    defaultEnabled: true,
  },
  {
    id: 'muse',
    name: 'Muse',
    role: 'knight',
    providerId: 'meta',
    tagline: 'Meta Muse',
    defaultEnabled: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    role: 'knight',
    providerId: 'deepseek',
    tagline: 'DeepSeek',
    defaultEnabled: true,
  },
];

/** Public seat list for GET /rt/v1/roster (no secrets, no fleet branding). */
export function publicRoster(roster = CONNECTOR_ROSTER) {
  return roster
    .filter((seat) => seat.role !== 'king')
    .map((seat) => ({
      id: seat.id,
      name: seat.name,
      role: seat.role,
      providerId: seat.providerId,
      tagline: seat.tagline,
      defaultEnabled: Boolean(seat.defaultEnabled),
    }));
}

export function knights(roster = CONNECTOR_ROSTER) {
  return roster.filter((seat) => seat.role === 'knight');
}

export function seatById(id, roster = CONNECTOR_ROSTER) {
  return roster.find((seat) => seat.id === id) || null;
}
