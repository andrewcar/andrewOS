/** Council roster carried over from the Round Table client (accents, roles, marks). */

export const ROSTER = [
  { id: 'king', name: 'You', role: 'king', providerId: 'human', accent: '#E7E9EF', mark: { kind: 'sigil', glyph: '♔' }, tagline: 'King', defaultEnabled: true, order: -1 },
  { id: 'botbot', name: 'BotBot', role: 'arbiter', providerId: 'arbiter', accent: '#E4B363', mark: { kind: 'sigil', glyph: '⬡' }, tagline: 'Arbiter', defaultEnabled: true, order: -1 },
  { id: 'codex', name: 'CodexBot', role: 'knight', providerId: 'openai', accent: '#10A37F', mark: { kind: 'initials', text: 'CX' }, tagline: 'OpenAI', defaultEnabled: true, order: 0 },
  { id: 'claude', name: 'ClaudeBot', role: 'knight', providerId: 'anthropic', accent: '#D4A27F', mark: { kind: 'initials', text: 'CL' }, tagline: 'Anthropic', defaultEnabled: true, order: 1 },
  { id: 'gemini', name: 'GeminiBot', role: 'knight', providerId: 'google', accent: '#4E8DF5', mark: { kind: 'initials', text: 'GM' }, tagline: 'Google Gemini', defaultEnabled: true, order: 2 },
  { id: 'muse', name: 'MuseBot', role: 'knight', providerId: 'meta', accent: '#8B7CF6', mark: { kind: 'initials', text: 'MU' }, tagline: 'Meta Muse', defaultEnabled: true, order: 3 },
  { id: 'deepseek', name: 'DeepSeekBot', role: 'knight', providerId: 'deepseek', accent: '#4D6BFE', mark: { kind: 'initials', text: 'DS' }, tagline: 'DeepSeek', defaultEnabled: true, order: 4 },
];

export const PROVIDERS = [
  { id: 'openai', label: 'Codex', hint: 'OpenAI API key', seatId: 'codex' },
  { id: 'anthropic', label: 'Claude', hint: 'Anthropic API key', seatId: 'claude' },
  { id: 'google', label: 'Gemini', hint: 'Google AI Studio key', seatId: 'gemini' },
  { id: 'meta', label: 'Muse', hint: 'Muse key — stored only, no browser relay yet', seatId: 'muse' },
  { id: 'deepseek', label: 'DeepSeek', hint: 'DeepSeek API key', seatId: 'deepseek' },
  { id: 'arbiter', label: 'BotBot', hint: 'Arbiter key (OpenAI-compatible)', seatId: 'botbot' },
];

export function knights(roster = ROSTER) {
  return roster.filter((seat) => seat.role === 'knight').sort((a, b) => a.order - b.order);
}

export function seatById(id, roster = ROSTER) {
  return roster.find((seat) => seat.id === id) || null;
}

export function presentRoster(roster, kingName) {
  return roster.map((seat) => (seat.id === 'king' ? { ...seat, name: kingName || seat.name } : seat));
}

export function markGlyph(seat) {
  return seat.mark.kind === 'initials' ? seat.mark.text : seat.mark.glyph;
}

/** Positions are percentages of the table layer so the disc can scale without JS math per frame. */
export function layoutSeats(seats) {
  const count = Math.max(seats.length, 1);
  const radius = 33;
  return seats.map((seat, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
    return {
      seat,
      left: 50 + radius * Math.cos(angle),
      top: 50 + radius * Math.sin(angle),
    };
  });
}
