/** Local delegation split. Same lenses and largest-remainder math as the council client. */

export const LENSES = [
  { id: 'frontend', re: /\b(ui|ux|design|frontend|css|react|component|animation|layout|accessibility|dashboard|page|chart|charts|settings)\b/gi, weights: { anthropic: 1.4, google: 1.2 }, label: 'Frontend & interaction', secondary: 'Frontend polish & a11y' },
  { id: 'backend', re: /\b(api|backend|database|schema|sql|server|auth|infra|deploy|endpoint|billing|invoice|export)\b/gi, weights: { openai: 1.4, deepseek: 1.2 }, label: 'Backend, data & API contracts', secondary: 'Data model & migrations' },
  { id: 'algorithms', re: /\b(algorithm|math|optimi\w*|proof|performance|complexity|model|numeric)\b/gi, weights: { deepseek: 1.5, openai: 1.1 }, label: 'Algorithms & performance', secondary: 'Profiling & budgets' },
  { id: 'creative', re: /\b(copy|story|brand|naming|tone|marketing|script|narrative|pitch)\b/gi, weights: { meta: 1.5, anthropic: 1.1 }, label: 'Copy, naming & tone', secondary: 'Voice & examples' },
  { id: 'research', re: /\b(research|summar\w*|compare|analysis|data|report|survey|evaluate)\b/gi, weights: { google: 1.3, anthropic: 1.1 }, label: 'Research & synthesis', secondary: 'Sources & comparison' },
];

const FALLBACKS = ['Review & integration', 'Tests & verification', 'Documentation & handoff'];

export function scoreLenses(prompt) {
  const scores = {};
  for (const lens of LENSES) {
    lens.re.lastIndex = 0;
    const hits = prompt.match(lens.re);
    scores[lens.id] = hits?.length ?? 0;
  }
  return scores;
}

export function percentSplit(entries, { minShare = 5 } = {}) {
  if (!entries.length) return [];
  const rows = entries.map((entry) => ({
    ...entry,
    weight: entry.blocked || entry.weight <= 0 ? 0 : entry.weight,
  }));
  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  const exact = rows.map((row) => (row.weight <= 0 || total <= 0 ? 0 : (row.weight / total) * 100));
  const floors = exact.map((value) => Math.floor(value));
  let remainder = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, frac: value - Math.floor(value), weight: rows[index]?.weight ?? 0 }))
    .filter((row) => row.weight > 0)
    .sort((a, b) => b.frac - a.frac || b.weight - a.weight);
  let cursor = 0;
  while (remainder > 0 && order.length > 0) {
    const pick = order[cursor % order.length];
    floors[pick.index] += 1;
    remainder -= 1;
    cursor += 1;
  }
  const active = rows.filter((row) => row.weight > 0).length;
  if (minShare > 0 && active > 0 && active <= 6) {
    for (let pass = 0; pass < 20; pass += 1) {
      const low = floors.findIndex((value, index) => (rows[index]?.weight ?? 0) > 0 && value < minShare);
      if (low < 0) break;
      let donor = -1;
      let donorValue = minShare;
      floors.forEach((value, index) => {
        if (index !== low && value > donorValue) {
          donor = index;
          donorValue = value;
        }
      });
      if (donor < 0) break;
      floors[donor] -= 1;
      floors[low] += 1;
    }
  }
  return rows.map((row, index) => ({
    seatId: row.seatId,
    percent: floors[index] ?? 0,
    responsibility: row.responsibility,
  }));
}

export function buildProposal({ prompt, knights, revision = 1, id, note = '', source = 'preview' }) {
  const scores = scoreLenses(prompt);
  const used = new Map();
  const weighted = knights.map((knight, index) => {
    const own = {};
    let weight = 1;
    for (const lens of LENSES) {
      const hits = scores[lens.id] ?? 0;
      own[lens.id] = hits;
      if (hits >= 1) weight *= lens.weights[knight.providerId] ?? 1;
    }
    const ranked = LENSES
      .map((lens) => ({ lens, hits: own[lens.id] ?? 0 }))
      .filter((row) => row.hits > 0)
      .sort((a, b) => b.hits - a.hits);
    const top = ranked[0]?.lens;
    let responsibility = FALLBACKS[index % FALLBACKS.length];
    if (top) {
      const seen = used.get(top.label) ?? 0;
      used.set(top.label, seen + 1);
      responsibility = seen === 0 ? top.label : top.secondary;
    }
    return { seatId: knight.id, weight, blocked: false, responsibility };
  });
  let allocations = percentSplit(weighted);
  let pattern = 'percent-split';
  const hitTotal = Object.values(scores).reduce((sum, value) => sum + value, 0);
  const dominant = LENSES
    .map((lens) => ({ lens, hits: scores[lens.id] ?? 0 }))
    .sort((a, b) => b.hits - a.hits)[0];
  const leader = [...allocations].sort((a, b) => b.percent - a.percent)[0];
  if (dominant && hitTotal > 0 && dominant.hits / hitTotal > 0.6 && (leader?.percent ?? 0) >= 55) {
    pattern = 'specialist';
    const leadPercent = Math.max(55, leader.percent);
    const others = allocations.filter((row) => row.seatId !== leader.seatId && row.percent > 0);
    const rest = 100 - leadPercent;
    const base = others.length ? Math.floor(rest / others.length) : 0;
    let extra = others.length ? rest - base * others.length : 0;
    allocations = allocations.map((row) => {
      if (row.seatId === leader.seatId) {
        return { ...row, percent: leadPercent, responsibility: `Lead — ${row.responsibility}` };
      }
      if (row.percent === 0) return row;
      const bump = extra > 0 ? 1 : 0;
      extra -= bump;
      return { ...row, percent: base + bump, responsibility: 'Review & integration' };
    });
  }
  const shares = allocations.filter((row) => row.percent > 0);
  const approach = note
    ? `Revised — ${note}`
    : pattern === 'specialist'
      ? 'One seat leads. The others review.'
      : `Percent split across ${shares.length} seats.`;
  return {
    id,
    revision,
    pattern,
    source,
    approach: approach || 'Even split across the enabled knights.',
    allocations,
    superseded: false,
  };
}
