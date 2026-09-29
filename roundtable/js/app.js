import { createAudio } from './audio.js';
import { createVault, questStorageKey } from './auth.js';
import { createOrchestrator } from './orchestrator.js';
import { ROSTER, seatById } from './roster.js';
import { createState, isBusy, reduce } from './state.js';
import { paintStrip, sync } from './ui.js';

const root = document.querySelector('#app');
const audio = createAudio();
const vault = createVault({ storage: localStorage, session: sessionStorage });

let sequence = 0;
const nid = (kind) => `${kind}_${(sequence += 1).toString(36)}`;
const context = () => ({
  now: () => new Date().toISOString(),
  id: nid,
  roster: ROSTER,
});

const model = {
  screen: 'auth',
  authMode: 'signup',
  authError: '',
  authPending: false,
  settingsNote: '',
  unlockError: '',
  armReset: false,
  account: null,
  aesKey: null,
  secrets: {},
  locked: false,
  sound: audio.enabled(),
  sendLock: false,
  state: null,
};

function persist() {
  if (!model.account || !model.state) return;
  localStorage.setItem(questStorageKey(model.account.id), JSON.stringify(model.state));
}

function loadQuest(account) {
  try {
    const parsed = JSON.parse(localStorage.getItem(questStorageKey(account.id)) || 'null');
    if (!parsed?.seats || !parsed.phase) return null;
    for (const seat of Object.values(parsed.seats)) {
      if (seat.status === 'thinking' || seat.status === 'working' || seat.status === 'waiting') {
        seat.status = 'idle';
        seat.since = null;
      }
    }
    if (parsed.phase.name === 'implementing' && parsed.phase.kickoff === 'running' && parsed.messages?.length) {
      parsed.phase = { ...parsed.phase, kickoff: 'done' };
    }
    return parsed;
  } catch {
    return null;
  }
}

function fitTable() {
  const layer = document.querySelector('[data-testid="round-table"]');
  if (!layer) return;
  if (layer.dataset.mode !== 'full') {
    layer.style.width = '';
    layer.style.height = '';
    const header = document.querySelector('.header');
    const bottom = header?.getBoundingClientRect().bottom ?? 64;
    layer.style.top = `${Math.round(bottom + 6)}px`;
    return;
  }
  const stage = document.querySelector('.stage');
  const rect = stage?.getBoundingClientRect();
  if (!rect) return;
  const size = Math.max(220, Math.floor(Math.min(rect.width - 28, rect.height - 56, 540)));
  layer.style.width = `${size}px`;
  layer.style.height = `${size}px`;
}

function render(flip) {
  const before = flip ? document.querySelector('[data-testid="round-table"]')?.getBoundingClientRect() : null;
  sync(root, model, ROSTER);
  fitTable();
  if (!before) return;
  const next = document.querySelector('[data-testid="round-table"]');
  if (!next) return;
  const after = next.getBoundingClientRect();
  const dx = (before.left + before.width / 2) - (after.left + after.width / 2);
  const dy = (before.top + before.height / 2) - (after.top + after.height / 2);
  const scale = after.width ? before.width / after.width : 1;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(scale - 1) < 0.02) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  next.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
      { transform: 'none' },
    ],
    { duration: reduced ? 0 : 460, easing: 'cubic-bezier(.16,.84,.32,1)' },
  );
}

function sounds(prev, next, action) {
  if (!prev) return;
  if (action.type === 'IMPLEMENT') {
    audio.cue('approve');
    audio.cue('dock');
  } else if (action.type === 'FOCUS_SET') {
    audio.cue(next.focus === 'chat' ? 'dock' : 'undock');
  }
  if (action.type === 'SEAT_TOGGLED' && action.enabled) audio.cue('enable');
  if (action.type === 'SEND') audio.cue('send');
  for (const message of next.messages) {
    if (message.kind !== 'chat' || message.seatId === 'king' || message.status !== 'done') continue;
    const prior = prev.messages.find((row) => row.id === message.id);
    if (prior && prior.status === 'done') continue;
    audio.voice(seatById(message.seatId, ROSTER)?.providerId || 'arbiter');
  }
}

function dispatch(action) {
  const prev = model.state;
  const prevFocus = prev?.focus;
  model.state = reduce(model.state, action, context());
  if (model.state === prev) return;
  model.armReset = false;
  persist();
  sounds(prev, model.state, action);
  render(Boolean(prevFocus && prevFocus !== model.state.focus));
  const follow = orchestrator.after(action);
  if (action.type === 'SEND') {
    Promise.resolve(follow).finally(() => {
      model.sendLock = false;
      if (model.screen === 'app') render(false);
    });
  }
}

const orchestrator = createOrchestrator({
  getState: () => model.state,
  dispatch,
  getSecrets: () => ({ ...model.secrets }),
  roster: ROSTER,
  delay: (ms) => new Promise((resolve) => { setTimeout(resolve, ms); }),
  now: () => new Date().toISOString(),
  id: nid,
});

function resume(state) {
  if (!state) return;
  if (state.phase.name === 'proposal' && state.phase.status === 'drafting') {
    orchestrator.after({ type: 'PROMPT_SUBMITTED' });
  } else if (state.phase.name === 'voting' && !state.phase.stalled) {
    orchestrator.after({ type: 'VOTE_CALLED' });
  } else if (state.phase.name === 'implementing' && state.phase.kickoff === 'running') {
    orchestrator.after({ type: 'IMPLEMENT' });
  }
}

function enter(account, aesKey, secrets) {
  model.account = account;
  model.aesKey = aesKey;
  model.secrets = secrets || {};
  model.locked = !aesKey && vault.hasSecrets(account.id);
  model.state = loadQuest(account) || createState({
    now: new Date().toISOString(),
    sessionId: nid('sess'),
    kingName: account.name,
    roster: ROSTER,
  });
  model.screen = 'app';
  model.authPending = false;
  model.authError = '';
  persist();
  render(false);
  resume(model.state);
}

model.onAuth = async ({ mode, name, email, password }) => {
  if (model.authPending) return;
  model.authPending = true;
  model.authError = '';
  render(false);
  try {
    const result = mode === 'signin'
      ? await vault.signIn({ email, password })
      : await vault.signUp({ email, password, name });
    enter(result.account, result.aesKey, result.secrets);
  } catch (error) {
    model.authPending = false;
    model.authError = error.message || 'Could not sign in.';
    render(false);
  }
};

model.onOpenSettings = () => {
  model.screen = 'settings';
  model.settingsNote = model.locked ? 'Unlock from the table before replacing saved keys.' : '';
  render(false);
};

model.onCloseSettings = () => {
  model.screen = 'app';
  render(false);
};

model.onSound = (enabled) => {
  audio.setEnabled(enabled);
  model.sound = audio.enabled();
  render(false);
};

model.onSignOut = () => {
  vault.clearSession();
  orchestrator.invalidate();
  model.account = null;
  model.aesKey = null;
  model.secrets = {};
  model.state = null;
  model.locked = false;
  model.screen = 'auth';
  model.authError = '';
  render(false);
};

model.onSaveKeys = async (form) => {
  if (!model.aesKey) {
    model.settingsNote = 'Unlock from the table before saving keys.';
    render(false);
    return;
  }
  const next = { ...model.secrets };
  for (const input of form.querySelectorAll('[data-provider]')) {
    const value = input.value.trim();
    if (value) next[input.dataset.provider] = value;
    input.value = '';
  }
  await vault.saveSecrets(model.account.id, model.aesKey, next);
  model.secrets = next;
  model.locked = false;
  model.settingsNote = 'Saved. Keys stay encrypted on this device.';
  render(false);
};

model.onRemoveKey = async (providerId) => {
  if (!model.aesKey) {
    model.settingsNote = 'Unlock from the table before removing keys.';
    render(false);
    return;
  }
  const next = { ...model.secrets };
  delete next[providerId];
  await vault.saveSecrets(model.account.id, model.aesKey, next);
  model.secrets = next;
  model.settingsNote = 'Key removed from this device.';
  render(false);
};

model.onClearKeys = async () => {
  if (!model.account) return;
  await vault.clearSecrets(model.account.id);
  model.secrets = {};
  model.settingsNote = 'All keys removed from this device.';
  render(false);
};

model.onUnlock = async (password) => {
  try {
    const result = await vault.unlock(password);
    model.aesKey = result.aesKey;
    model.secrets = result.secrets || {};
    model.locked = false;
    model.unlockError = '';
    render(false);
  } catch (error) {
    model.unlockError = error.message || 'Could not unlock keys.';
    render(false);
  }
};

model.onPrompt = (text) => dispatch({ type: 'PROMPT_CHANGED', text });
model.onConfirm = () => dispatch({ type: 'SEATS_CONFIRMED' });
model.onSubmitPrompt = () => dispatch({ type: 'PROMPT_SUBMITTED' });
model.onCallVote = () => dispatch({ type: 'VOTE_CALLED' });
model.onRetry = () => dispatch({ type: 'PROPOSAL_RETRY' });
model.onRevise = (note) => dispatch({ type: 'REVISION_REQUESTED', note });
model.onDecree = () => dispatch({ type: 'DECREE', decision: 'proceed' });
model.onToggleFocus = () => {
  if (!model.state) return;
  dispatch({ type: 'FOCUS_SET', focus: model.state.focus === 'chat' ? 'table' : 'chat' });
};
model.onToggleSeat = (seatId) => {
  const seat = model.state?.seats[seatId];
  if (!seat) return;
  dispatch({ type: 'SEAT_TOGGLED', seatId, enabled: !seat.enabled, messageId: nid('msg') });
};
model.onTarget = (seatId) => dispatch({ type: 'TARGET_SET', seatId: seatId || null, replyTo: null });
model.onApprove = () => {
  const button = document.querySelector('[data-testid="approve-plan"]');
  if (button) {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Opening chat…';
  }
  dispatch({ type: 'IMPLEMENT' });
};
model.onReply = (messageId) => {
  const message = model.state?.messages.find((row) => row.id === messageId);
  if (!message || message.kind !== 'chat' || message.seatId === 'king') return;
  const seat = message.seatId === 'king' ? null : seatById(message.seatId, ROSTER);
  dispatch({
    type: 'TARGET_SET',
    seatId: message.seatId === 'king' ? model.state.targetSeatId : message.seatId,
    replyTo: { id: message.id, name: seat?.name || model.state.kingName, text: message.text },
  });
  document.querySelector('[data-testid="composer-textarea"]')?.focus();
};
model.onSend = (text) => {
  if (model.sendLock || !model.state) return false;
  if (model.state.phase.name !== 'implementing' || model.state.phase.kickoff === 'running' || isBusy(model.state)) {
    return false;
  }
  const trimmed = String(text || '').trim();
  if (!trimmed) return false;
  model.sendLock = true;
  const messageId = nid('msg');
  dispatch({ type: 'SEND', text: trimmed, messageId });
  const accepted = model.state.messages.some((message) => message.id === messageId);
  if (!accepted) model.sendLock = false;
  return accepted;
};
model.onNewTable = () => {
  if (!model.armReset) {
    model.armReset = true;
    render(false);
    return;
  }
  dispatch({ type: 'SESSION_RESET' });
};

window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
window.addEventListener('resize', () => fitTable());
setInterval(() => {
  if (model.screen !== 'app' || !model.state || !isBusy(model.state)) return;
  paintStrip(root, model.state, ROSTER);
}, 1000);

const existing = vault.session();
if (existing) {
  enter(
    { id: existing.userId, email: existing.email, name: existing.name },
    null,
    {},
  );
} else {
  render(false);
}
