import { KEY_UNLOCK_PROMPT } from './key-storage.js';
import { PROVIDERS, knights, layoutSeats, markGlyph, presentRoster, seatById } from './roster.js';
import { currentTally, dockSeatIds, enabledKnights, isBusy, latestProposal, resolveArbiter, stripText } from './state.js';

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function modeLabel(secrets, state, roster) {
  const arbiter = resolveArbiter(state, roster);
  const needed = [...new Set([
    arbiter?.providerId,
    ...enabledKnights(state, roster).map((seat) => seat.providerId),
  ].filter(Boolean))];
  const have = needed.filter((id) => secrets?.[id]);
  if (!have.length) return 'Preview';
  if (have.length === needed.length) return 'Live';
  return 'Mixed';
}

function panelKey(state, roster) {
  const proposal = latestProposal(state);
  const score = currentTally(state, roster);
  return [
    state.phase.name,
    state.phase.status || '',
    state.phase.revision || '',
    state.phase.stalled ? '1' : '',
    state.phase.error || '',
    state.arbiterId || '',
    proposal?.id || '',
    proposal?.approach || '',
    (proposal?.allocations || []).map((row) => `${row.seatId}:${row.percent}`).join(','),
    state.feed.length,
    `${score.agree}/${score.disagree}/${score.pending}/${score.outcome}`,
  ].join('|');
}

function tableStructureKey(state, roster) {
  const ids = state.focus === 'chat'
    ? dockSeatIds(state, roster)
    : presentRoster(roster, state.kingName).map((seat) => seat.id);
  return [state.focus, state.phase.name, state.kingName, state.arbiterId || '', ids.join('.')].join('|');
}

function visibleSeats(state, roster) {
  const rosterNow = presentRoster(roster, state.kingName);
  if (state.focus !== 'chat') return rosterNow;
  const ids = new Set(dockSeatIds(state, roster));
  return rosterNow.filter((seat) => ids.has(seat.id));
}

function tableHtml(state, roster) {
  const mode = state.focus === 'chat' ? 'dock' : 'full';
  const seats = layoutSeats(visibleSeats(state, roster), mode);
  const quest = state.phase.name === 'implementing';
  const center = mode === 'dock' || quest
    ? `<button type="button" class="medallion" data-action="toggle-focus" data-testid="table-center" aria-label="${mode === 'dock' ? 'Show the round table' : 'Return to chat'}">
        <span class="medallion-kicker">${mode === 'dock' ? 'Show' : 'Return'}</span>
        <span class="medallion-title">${mode === 'dock' ? 'Table' : 'Chat'}</span>
      </button>`
    : `<div class="medallion" data-testid="table-center"><span class="medallion-kicker">Round</span><span class="medallion-title">Table</span></div>`;
  const seatHtml = seats.map(({ seat, left, top }) => {
    const seatState = state.seats[seat.id];
    const enabled = seat.role === 'king' ? true : seatState?.enabled !== false;
    const status = seatState?.status || 'idle';
    const arbiterId = resolveArbiter(state, roster)?.id;
    const canToggle = seat.role !== 'king' && seat.id !== arbiterId && mode === 'full' && (
      state.phase.name === 'seats' || state.phase.name === 'prompt' || quest
    );
    const canTarget = mode === 'dock';
    const tag = canToggle || canTarget ? 'button' : 'div';
    const action = canTarget ? 'target' : canToggle ? 'toggle-seat' : '';
    const testid = canTarget ? `seat-target-${seat.id}` : `seat-${seat.id}`;
    const label = canTarget ? `Talk to ${seat.name}` : canToggle ? `${enabled ? 'Disable' : 'Enable'} ${seat.name}` : seat.name;
    return `<${tag}
      class="seat"
      style="left:${left}%;top:${top}%;--seat:${seat.accent}"
      data-enabled="${enabled ? 'true' : 'false'}"
      data-status="${escapeHtml(status)}"
      data-testid="${testid}"
      data-seat="${seat.id}"
      ${action ? `data-action="${action}"` : ''}
      ${tag === 'button' ? `type="button" aria-label="${escapeHtml(label)}" aria-pressed="${enabled ? 'true' : 'false'}"` : `role="img" aria-label="${escapeHtml(label)}"`}
    ><span class="seat-glyph">${escapeHtml(markGlyph(seat))}</span><span class="seat-name">${escapeHtml(seatShortName(seat))}</span></${tag}>`;
  }).join('');
  return `<div class="table-layer" data-mode="${mode}" data-testid="round-table" data-dock="${mode === 'dock' ? 'true' : 'false'}">
    <div class="ring"></div>
    ${center}
    ${seatHtml}
  </div>`;
}

/** Display name for a seat label. Roster names are already product-facing. */
function seatShortName(seat) {
  return seat?.name || '';
}

function proposalHtml(proposal, roster, arbiterName) {
  if (!proposal) return '';
  const rows = proposal.allocations.filter((row) => row.percent > 0).map((row) => {
    const seat = seatById(row.seatId, roster);
    return `<div class="alloc">
      <div class="alloc-top"><span class="swatch" style="background:${seat?.accent || '#fff'}"></span><span>${escapeHtml(seat?.name || row.seatId)}</span><span>${row.percent}%</span></div>
      <div class="bar"><span style="width:${row.percent}%;background:${seat?.accent || '#fff'}"></span></div>
      <div class="alloc-job">${escapeHtml(row.responsibility)}</div>
    </div>`;
  }).join('');
  return `<article class="card" data-testid="proposal-card">
    <div class="card-kicker">Delegation proposal · Rev ${proposal.revision} · ${escapeHtml(arbiterName)}${proposal.source === 'preview' ? ' · preview' : ''}</div>
    <p>${escapeHtml(proposal.approach)}</p>
    ${rows}
  </article>`;
}

function arbiterCopy(state, roster, secrets) {
  const seat = resolveArbiter(state, roster);
  if (!seat) return '';
  if (!secrets?.[seat.providerId]) {
    return `${seat.name} has no API key yet. A quest still runs, and the split is marked as a local preview.`;
  }
  if (seat.providerId === 'meta') {
    return `${seat.name} is the arbiter. Muse has no browser relay, so a live split cannot be drafted.`;
  }
  return `${seat.name} is the arbiter.`;
}

function arbiterControl(state, roster, secrets) {
  const current = resolveArbiter(state, roster);
  const choices = roster.filter((seat) => seat.role !== 'king');
  const options = choices.map((seat) => (
    `<option value="${escapeHtml(seat.id)}"${seat.id === current?.id ? ' selected' : ''}>${escapeHtml(seat.name)}</option>`
  )).join('');
  return `<label class="arbiter-field">Arbiter
      <select data-testid="arbiter-select" aria-label="Arbiter">${options}</select>
    </label>
    <p class="muted" data-testid="arbiter-note">${escapeHtml(arbiterCopy(state, roster, secrets))}</p>`;
}

export function arbiterSettingsCopy(state, roster, secrets, locked = false) {
  const seat = resolveArbiter(state, roster);
  if (!seat) return '';
  if (locked && !secrets?.[seat.providerId]) {
    return `${seat.name} is the arbiter. Saved keys are locked. Enter your password to unlock key storage.`;
  }
  if (!secrets?.[seat.providerId]) {
    return `${seat.name} is the arbiter and has no key yet. Add that seat's key, or the quest stays on a local preview.`;
  }
  if (seat.providerId === 'meta') {
    return `${seat.name} is the arbiter. The Muse key is saved, and this host has no browser relay for it.`;
  }
  return `${seat.name} is the arbiter. That seat's key is used for proposals and arbiter turns.`;
}

function panelHtml(state, roster, secrets) {
  const phase = state.phase.name;
  const count = enabledKnights(state, roster).length;
  const arbiter = resolveArbiter(state, roster);
  if (phase === 'seats') {
    return `<div class="planning-scroll"><div class="card">
      <div class="card-kicker">Seats</div>
      <p>Confirm your seats, then set the job on the table. ${count} seat${count === 1 ? '' : 's'} will share the work.</p>
      ${arbiterControl(state, roster, secrets)}
      <button type="button" class="primary" data-action="confirm-seats" data-testid="confirm-seats" ${count < 1 ? 'disabled' : ''}>Confirm seats</button>
    </div></div>`;
  }
  if (phase === 'prompt') {
    return `<div class="planning-scroll"><div class="card" data-testid="prompt-card">
      <label class="card-kicker" for="quest-prompt">The job</label>
      ${arbiterControl(state, roster, secrets)}
      <textarea id="quest-prompt" data-testid="prompt-textarea" rows="4" maxlength="8000" placeholder="Describe the job for the council…">${escapeHtml(state.prompt)}</textarea>
      <div class="row">
        <span class="muted" data-count>${state.prompt.trim().length} / 8000</span>
        <button type="button" class="primary" data-action="submit-prompt" data-testid="prompt-submit" ${state.prompt.trim() ? '' : 'disabled'}>Set the job</button>
      </div>
    </div></div>`;
  }
  const proposal = latestProposal(state);
  const score = currentTally(state, roster);
  const feed = state.feed.slice(-6).map((line) => `<li>${escapeHtml(line.text)}</li>`).join('');
  let actions = '';
  if (phase === 'proposal' && state.phase.status === 'revealed') {
    actions = `<div class="row"><button type="button" class="primary" data-action="call-vote" data-testid="call-vote">Call the vote</button></div>`;
  } else if (phase === 'proposal' && state.phase.status === 'error') {
    actions = `<p class="warn">${escapeHtml(state.phase.error || 'Drafting failed.')}</p><button type="button" class="primary" data-action="retry-proposal">Retry</button>`;
  } else if (phase === 'proposal' && state.phase.status === 'drafting') {
    actions = `<p class="muted">${escapeHtml(arbiter?.name || 'Grok (API)')} is drafting the split.</p>`;
  } else if (phase === 'voting') {
    actions = `<p data-testid="tally">${score.pending ? `${score.agree + score.disagree} of ${score.agree + score.disagree + score.pending + score.failed} votes in` : `${score.agree} agree · ${score.disagree} disagree`}${state.phase.stalled ? ' · divided' : ''}</p>`;
    if (state.phase.stalled) {
      actions += `<button type="button" class="primary" data-action="decree">Proceed anyway</button>`;
    }
  } else if (phase === 'ready') {
    actions = `<p>The table passed the split. Approve it and the council moves into the quest chat.</p>
      <div class="row">
        <button type="button" class="primary" data-action="approve" data-testid="approve-plan">Approve plan</button>
        <button type="button" class="ghost" data-action="revise">Ask for a revision</button>
      </div>`;
  }
  const revision = phase === 'ready'
    ? `<label class="revision">Note for a revision
        <input data-testid="revision-note" maxlength="400" placeholder="Optional note for ${escapeHtml(arbiter?.name || 'Grok (API)')}" />
      </label>`
    : '';
  return `<div class="planning-scroll"><ul class="feed" data-testid="planning-feed">${feed}</ul>
    ${proposalHtml(proposal, roster, arbiter?.name || 'Grok (API)')}
    ${revision}</div>
    <div class="planning-actions">${actions}</div>`;
}

function messageHtml(message, roster, kingName) {
  if (message.kind === 'status') {
    return `<p class="status-line" data-message-id="${escapeHtml(message.id)}">${escapeHtml(message.text)}</p>`;
  }
  const seat = message.seatId === 'king'
    ? { name: kingName, accent: '#E7E9EF', mark: { kind: 'sigil', glyph: '♔' } }
    : seatById(message.seatId, roster);
  const accent = seat?.accent || '#E7E9EF';
  const quote = message.replyTo
    ? `<div class="quote">${escapeHtml(message.replyTo.name)} · ${escapeHtml(String(message.replyTo.text).slice(0, 140))}</div>`
    : '';
  return `<article class="msg${message.seatId === 'king' ? ' king' : ''}" data-message-id="${escapeHtml(message.id)}" style="--seat:${accent}">
    <div class="bubble">
      <span class="seat-icon" aria-hidden="true">${escapeHtml(message.seatId === 'king' ? (kingName || 'Y').slice(0, 1).toUpperCase() : markGlyph(seat || { mark: { kind: 'initials', text: '?' } }))}</span>
      ${quote}
      <div class="msg-body"></div>
      ${message.seatId === 'king' ? '' : `<button type="button" class="reply-btn" data-action="reply" data-reply="${escapeHtml(message.id)}">Reply</button>`}
    </div>
  </article>`;
}

function fillBody(node, message) {
  const body = node.querySelector('.msg-body');
  if (!body) return;
  if (body.dataset.raw === message.text && body.dataset.status === (message.status || '')) return;
  body.dataset.raw = message.text;
  body.dataset.status = message.status || '';
  body.textContent = message.text;
  if (message.status === 'streaming') {
    const caret = document.createElement('span');
    caret.className = 'caret';
    body.append(caret);
  }
}

function seatControlLabel(seat, state, enabled) {
  if (!seat) return '';
  if (state.focus === 'chat' && seat.role !== 'king') return `Talk to ${seat.name}`;
  if (seat.id === (state.arbiterId || 'botbot')) return seat.name;
  if (seat.role !== 'king') return `${enabled ? 'Disable' : 'Enable'} ${seat.name}`;
  return seat.name;
}

function paintTable(slot, state, roster) {
  const key = tableStructureKey(state, roster);
  if (slot.dataset.key !== key) {
    slot.dataset.key = key;
    slot.innerHTML = tableHtml(state, roster);
  }
  slot.querySelectorAll('[data-seat]').forEach((node) => {
    const seat = seatById(node.dataset.seat, roster);
    const seatState = state.seats[node.dataset.seat];
    const enabled = seat?.role === 'king' ? true : seatState?.enabled !== false;
    node.dataset.enabled = enabled ? 'true' : 'false';
    node.dataset.status = seatState?.status || 'idle';
    if (node.tagName !== 'BUTTON') return;
    node.setAttribute('aria-label', seatControlLabel(seat, state, enabled));
    node.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  });
}

function syncMessages(inner, state, roster, preserveScroll) {
  const messages = state.messages;
  const scroller = inner.parentElement;
  if (scroller && !scroller.dataset.bound) {
    scroller.dataset.bound = '1';
    scroller.dataset.pinned = '1';
    scroller.addEventListener('scroll', () => {
      if (scroller.dataset.suspended === '1') return;
      const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
      scroller.dataset.pinned = distance < 96 ? '1' : '0';
    }, { passive: true });
  }
  const pinned = !scroller || scroller.dataset.pinned !== '0';
  const existing = new Map([...inner.querySelectorAll('[data-message-id]')].map((node) => [node.dataset.messageId, node]));
  const live = new Set(messages.map((message) => message.id));
  for (const [id, node] of existing) {
    if (!live.has(id)) node.remove();
  }
  let cursor = inner.firstElementChild;
  messages.forEach((message) => {
    let node = existing.get(message.id);
    if (!node || !node.isConnected) {
      const holder = document.createElement('template');
      holder.innerHTML = messageHtml(message, roster, state.kingName);
      node = holder.content.firstElementChild;
      inner.insertBefore(node, cursor);
    } else if (node !== cursor) {
      inner.insertBefore(node, cursor);
    }
    if (message.kind === 'status') {
      if (node.textContent !== message.text) node.textContent = message.text;
    } else {
      fillBody(node, message);
    }
    cursor = node.nextElementSibling;
  });
  if (!preserveScroll && pinned && scroller && scroller.dataset.suspended !== '1') {
    scroller.scrollTop = scroller.scrollHeight;
  }
}

function secretsEmpty(secrets) {
  return !Object.values(secrets || {}).some(Boolean);
}

export function paintStrip(root, state, roster) {
  const strip = root.querySelector('[data-testid="status-strip"]');
  if (!strip || !state) return;
  const text = stripText(state, roster, Date.now());
  if (strip.textContent !== text) strip.textContent = text;
}

export function sync(root, model, roster) {
  if (root.dataset.screen !== model.screen) {
    root.dataset.screen = model.screen;
    root.replaceChildren();
    if (model.screen === 'auth') mountAuth(root, model);
    else if (model.screen === 'settings') mountSettings(root, model, roster);
    else mountApp(root, model, roster);
    return;
  }
  if (model.screen === 'auth') {
    const error = root.querySelector('[data-auth-error]');
    if (error) error.textContent = model.authError || '';
    const pending = root.querySelector('[data-auth-submit]');
    if (pending) pending.textContent = model.authPending ? 'Seating you…' : (model.authMode === 'signin' ? 'Sign in' : 'Create account');
    return;
  }
  if (model.screen === 'settings') {
    paintSettings(root, model, roster);
    return;
  }
  updateApp(root, model, roster);
}

function mountAuth(root, model) {
  root.innerHTML = `<div class="gate">
    <p class="eyebrow">Round Table</p>
    <h1>Take a seat</h1>
    <p class="lede">Open to anyone on this device. No admin token. Provider keys stay encrypted here and are never put in the page.</p>
    <div class="tabs" role="tablist">
      <button type="button" data-action="auth-mode" data-mode="signup" aria-pressed="${model.authMode === 'signin' ? 'false' : 'true'}">Create account</button>
      <button type="button" data-action="auth-mode" data-mode="signin" aria-pressed="${model.authMode === 'signin' ? 'true' : 'false'}">Sign in</button>
    </div>
    <form data-testid="auth-form">
      <label class="name-field">Display name <input name="name" autocomplete="nickname" maxlength="40" /></label>
      <label>Email <input name="email" type="email" autocomplete="username" required /></label>
      <label>Password <input name="password" type="password" autocomplete="new-password" required minlength="8" /></label>
      <p class="warn" data-auth-error>${escapeHtml(model.authError || '')}</p>
      <button type="submit" class="primary" data-auth-submit>${model.authMode === 'signin' ? 'Sign in' : 'Create account'}</button>
    </form>
  </div>`;
  applyAuthMode(root, model.authMode || 'signup');
  const gate = root.querySelector('.gate');
  gate.querySelector('[data-testid="auth-form"]').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    model.onAuth({
      mode: model.authMode || 'signup',
      name: data.get('name'),
      email: data.get('email'),
      password: data.get('password'),
    });
  });
  gate.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="auth-mode"]');
    if (!button) return;
    model.authMode = button.dataset.mode;
    applyAuthMode(root, model.authMode);
  });
}

function applyAuthMode(root, mode) {
  root.querySelectorAll('[data-action="auth-mode"]').forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.mode === mode ? 'true' : 'false');
  });
  const name = root.querySelector('.name-field');
  if (name) name.hidden = mode === 'signin';
  const submit = root.querySelector('[data-auth-submit]');
  if (submit && !submit.dataset.pending) submit.textContent = mode === 'signin' ? 'Sign in' : 'Create account';
  const password = root.querySelector('input[name="password"]');
  if (password) password.setAttribute('autocomplete', mode === 'signin' ? 'current-password' : 'new-password');
}

function mountSettings(root, model, roster) {
  const rows = PROVIDERS.map((provider) => `<label class="key-row">
      <span><strong>${escapeHtml(provider.label)}</strong><small>${escapeHtml(provider.hint)}</small><em data-key-state="${provider.id}">${keyStateLabel(model, provider.id)}</em></span>
      <input type="password" data-provider="${provider.id}" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(keyPlaceholder(model, provider.id))}" />
      <button type="button" class="ghost" data-action="remove-key" data-provider="${provider.id}">Remove</button>
    </label>`).join('');
  const noteClass = model.settingsNoteKind === 'error' ? 'muted warn' : 'muted';
  root.innerHTML = `<div class="settings">
    <div class="settings-bar"><button type="button" class="ghost" data-action="close-settings">Back</button><h1>Settings</h1></div>
    <section class="empty-keys" data-testid="keys-empty" ${secretsEmpty(model.secrets) && !model.locked ? '' : 'hidden'}>
      <p class="empty-keys-title">No API keys yet</p>
      <p>That’s fine — you can still walk through a preview quest. When you are ready for live seats, paste a provider key below. The xAI field talks to Grok models over the API — not a full assistant with tools or memory.</p>
    </section>
    <p class="fine" data-testid="arbiter-key-note">${escapeHtml(arbiterSettingsCopy(model.state, roster, model.secrets, model.locked))}</p>
    <form data-testid="settings-form" aria-busy="${model.keysPending ? 'true' : 'false'}">
      <label class="key-unlock" data-testid="settings-unlock" ${model.aesKey ? 'hidden' : ''}>
        ${escapeHtml(KEY_UNLOCK_PROMPT)}
        <input type="password" autocomplete="current-password" spellcheck="false" data-testid="settings-password" aria-describedby="settings-note" />
      </label>
      ${rows}
      <div class="row">
        <button type="submit" class="primary" data-testid="settings-save" ${model.keysPending ? 'disabled' : ''}>Save keys</button>
        <button type="button" class="ghost" data-action="clear-keys">Remove all keys</button>
      </div>
      <p class="${noteClass}" id="settings-note" data-settings-note aria-live="polite">${escapeHtml(model.settingsNote || '')}</p>
    </form>
    <label class="sound-line"><input type="checkbox" data-action="sound-pref" ${model.sound ? 'checked' : ''} /> Seat sounds</label>
    <p class="fine">Keys are encrypted with AES-GCM before they are stored on this device. They are not logged and they are not written into the site source. Calls go to the provider, or the seat shows a blocked status if the browser cannot reach them.</p>
    <p class="fine"><a href="https://relay.andrewos.com/admin/login?next=/roundtable">Hearth admin relay</a></p>
  </div>`;
  const settings = root.querySelector('.settings');
  settings.querySelector('[data-testid="settings-form"]').addEventListener('submit', (event) => {
    event.preventDefault();
    model.onSaveKeys(event.currentTarget);
  });
  settings.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]');
    if (!action) return;
    if (action.dataset.action === 'close-settings') model.onCloseSettings();
    if (action.dataset.action === 'remove-key') model.onRemoveKey(action.dataset.provider);
    if (action.dataset.action === 'clear-keys') model.onClearKeys();
  });
  settings.addEventListener('change', (event) => {
    if (event.target.matches('[data-action="sound-pref"]')) model.onSound(event.target.checked);
  });
  void roster;
}

function keyStateLabel(model, providerId) {
  return model.secrets?.[providerId] ? 'Saved on this device' : 'Not set';
}

function keyPlaceholder(model, providerId) {
  return model.secrets?.[providerId] ? 'Saved · enter a new key to replace' : 'Not set';
}

function paintSettings(root, model, roster) {
  const note = root.querySelector('[data-settings-note]');
  if (note) {
    note.textContent = model.settingsNote || '';
    note.classList.toggle('warn', model.settingsNoteKind === 'error');
  }
  const unlock = root.querySelector('[data-testid="settings-unlock"]');
  if (unlock) unlock.hidden = Boolean(model.aesKey);
  const passwordInput = root.querySelector('[data-testid="settings-password"]');
  if (passwordInput) passwordInput.setAttribute('aria-invalid', model.settingsNoteKind === 'error' ? 'true' : 'false');
  const save = root.querySelector('[data-testid="settings-save"]');
  if (save) save.disabled = Boolean(model.keysPending);
  root.querySelectorAll('[data-action="remove-key"], [data-action="clear-keys"]').forEach((button) => {
    button.disabled = Boolean(model.keysPending);
  });
  const form = root.querySelector('[data-testid="settings-form"]');
  if (form) form.setAttribute('aria-busy', model.keysPending ? 'true' : 'false');
  paintKeyState(root, model, roster);
}

function paintKeyState(root, model, roster) {
  const secrets = model.secrets;
  root.querySelectorAll('[data-key-state]').forEach((node) => {
    node.textContent = keyStateLabel(model, node.dataset.keyState);
  });
  root.querySelectorAll('[data-provider]').forEach((input) => {
    if (document.activeElement === input) return;
    input.placeholder = keyPlaceholder(model, input.dataset.provider);
  });
  const empty = root.querySelector('[data-testid="keys-empty"]');
  if (empty) empty.hidden = model.locked || !secretsEmpty(secrets);
  const note = root.querySelector('[data-testid="arbiter-key-note"]');
  if (note) note.textContent = arbiterSettingsCopy(model.state, roster, secrets, model.locked);
}

function mountApp(root, model, roster) {
  root.innerHTML = `<div class="app" data-focus="table">
    <header class="header">
      <div class="brand"><span class="brand-mark">⬡</span><div><strong>Round Table</strong><small data-brand-sub></small></div></div>
      <div class="header-actions">
        <span class="chip" data-testid="mode-chip"></span>
        <button type="button" class="ghost" data-action="sound" data-testid="sound-toggle"></button>
        <button type="button" class="ghost" data-action="settings">Settings</button>
        <button type="button" class="ghost" data-action="new-table" data-testid="new-table">New table</button>
        <button type="button" class="ghost" data-action="sign-out">Sign out</button>
      </div>
    </header>
    <aside class="keys-nudge" data-testid="keys-nudge" ${secretsEmpty(model.secrets) ? '' : 'hidden'}>
      <p>No API keys saved yet — the table can still preview a quest. Open <button type="button" class="linkish" data-action="settings">Settings</button> when you want a seat to speak live.</p>
    </aside>
    <div class="stage-layout" data-testid="stage-layout">
      <div class="stage"><div class="table-slot"></div><div class="chat-scroll" data-testid="chat-panel"><div class="chat-inner"></div></div></div>
      <div class="status-strip" data-testid="status-strip" aria-live="polite"></div>
      <section class="planning"></section>
    </div>
    <form class="unlock" data-testid="unlock-form" hidden>
      <span>Saved keys are locked on this device.</span>
      <input type="password" name="password" autocomplete="current-password" placeholder="Password" />
      <button type="submit" class="primary">Unlock</button>
      <span class="warn" data-unlock-error></span>
    </form>
    <form class="composer" data-testid="composer">
      <div class="target-row"><span data-testid="target-chip"></span><button type="button" class="ghost" data-action="clear-target">Everyone</button></div>
      <div class="composer-box">
        <textarea data-testid="composer-textarea" rows="2" maxlength="4000" placeholder="Message the table…"></textarea>
        <button type="submit" class="primary" data-testid="composer-send">Send</button>
      </div>
    </form>
  </div>`;
  const app = root.querySelector('.app');
  app.addEventListener('click', (event) => {
    const control = event.target.closest('[data-action]');
    if (!control) return;
    const action = control.dataset.action;
    if (action === 'settings') model.onOpenSettings();
    if (action === 'sign-out') model.onSignOut();
    if (action === 'sound') model.onSound(!model.sound);
    if (action === 'new-table') model.onNewTable();
    if (action === 'confirm-seats') model.onConfirm();
    if (action === 'submit-prompt') model.onSubmitPrompt();
    if (action === 'call-vote') model.onCallVote();
    if (action === 'approve') model.onApprove();
    if (action === 'retry-proposal') model.onRetry();
    if (action === 'revise') model.onRevise(root.querySelector('[data-testid="revision-note"]')?.value || '');
    if (action === 'decree') model.onDecree();
    if (action === 'toggle-focus') model.onToggleFocus();
    if (action === 'toggle-seat') model.onToggleSeat(control.dataset.seat);
    if (action === 'target') model.onTarget(control.dataset.seat);
    if (action === 'reply') model.onReply(control.dataset.reply);
    if (action === 'clear-target') model.onTarget(null);
  });
  app.addEventListener('change', (event) => {
    if (!event.target.matches('[data-testid="arbiter-select"]')) return;
    model.onArbiter(event.target.value);
  });
  app.addEventListener('input', (event) => {
    if (!event.target.matches('[data-testid="prompt-textarea"]')) return;
    model.onPrompt(event.target.value);
    const count = root.querySelector('[data-count]');
    if (count) count.textContent = `${event.target.value.trim().length} / 8000`;
    const button = root.querySelector('[data-action="submit-prompt"]');
    if (button) button.disabled = !event.target.value.trim();
  });
  app.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && event.target.matches('[data-testid="prompt-textarea"]')) {
      event.preventDefault();
      model.onSubmitPrompt();
    }
  });
  root.querySelector('[data-testid="unlock-form"]').addEventListener('submit', (event) => {
    event.preventDefault();
    model.onUnlock(new FormData(event.currentTarget).get('password'));
  });
  const composer = root.querySelector('[data-testid="composer"]');
  const composerText = composer.querySelector('textarea');
  const submitComposer = () => {
    const accepted = model.onSend(composerText.value);
    if (accepted) composerText.value = '';
  };
  composer.addEventListener('submit', (event) => {
    event.preventDefault();
    submitComposer();
  });
  composerText.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    submitComposer();
  });
  updateApp(root, model, roster);
}

function updateApp(root, model, roster) {
  const state = model.state;
  const app = root.querySelector('.app');
  if (!app || !state) return;
  const scroller = root.querySelector('.chat-scroll');
  const leavingChat = app.dataset.focus === 'chat' && state.focus !== 'chat';
  const returningChat = app.dataset.focus !== 'chat' && state.focus === 'chat' && scroller?.dataset.savedScroll != null;
  if (leavingChat && scroller) {
    scroller.dataset.savedScroll = String(scroller.scrollTop);
    scroller.dataset.suspended = '1';
  }
  app.dataset.focus = state.focus;
  const layout = root.querySelector('[data-testid="stage-layout"]');
  layout.dataset.focus = state.focus;
  layout.dataset.phase = state.phase.name;
  layout.dataset.phaseStatus = state.phase.status || state.phase.kickoff || '';
  const sub = root.querySelector('[data-brand-sub]');
  if (sub) sub.textContent = state.kingName;
  const chip = root.querySelector('[data-testid="mode-chip"]');
  if (chip) chip.textContent = modeLabel(model.secrets, state, roster);
  const nudge = root.querySelector('[data-testid="keys-nudge"]');
  if (nudge) nudge.hidden = !secretsEmpty(model.secrets);
  const sound = root.querySelector('[data-testid="sound-toggle"]');
  if (sound) {
    const label = model.sound ? 'Sound on' : 'Sound off';
    sound.textContent = label;
    sound.setAttribute('aria-label', label);
    sound.setAttribute('aria-pressed', model.sound ? 'true' : 'false');
  }
  const reset = root.querySelector('[data-testid="new-table"]');
  if (reset) reset.textContent = model.armReset ? 'Confirm reset' : 'New table';
  const unlock = root.querySelector('[data-testid="unlock-form"]');
  if (unlock) unlock.hidden = !model.locked;
  const unlockError = root.querySelector('[data-unlock-error]');
  if (unlockError) unlockError.textContent = model.unlockError || '';
  paintTable(root.querySelector('.table-slot'), state, roster);
  const planning = root.querySelector('.planning');
  const nextPanel = panelKey(state, roster);
  if (planning.dataset.key !== nextPanel) {
    const prompt = planning.querySelector('[data-testid="prompt-textarea"]');
    const selection = prompt && document.activeElement === prompt
      ? [prompt.selectionStart, prompt.selectionEnd]
      : null;
    planning.dataset.key = nextPanel;
    planning.innerHTML = panelHtml(state, roster, model.secrets);
    if (selection) {
      const next = planning.querySelector('[data-testid="prompt-textarea"]');
      if (next) {
        next.focus();
        next.setSelectionRange(selection[0], selection[1]);
      }
    }
  } else {
    const count = planning.querySelector('[data-count]');
    if (count) count.textContent = `${state.prompt.trim().length} / 8000`;
    const arbiterSelect = planning.querySelector('[data-testid="arbiter-select"]');
    if (arbiterSelect && arbiterSelect.value !== (state.arbiterId || 'botbot')) {
      arbiterSelect.value = state.arbiterId || 'botbot';
    }
  }
  syncMessages(root.querySelector('.chat-inner'), state, roster, Boolean(returningChat));
  if (returningChat && scroller) {
    void scroller.offsetHeight;
    scroller.scrollTop = scroller.dataset.pinned === '0'
      ? Number(scroller.dataset.savedScroll)
      : scroller.scrollHeight;
    const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    scroller.dataset.pinned = distance < 96 ? '1' : '0';
  }
  if (scroller && state.focus === 'chat') scroller.dataset.suspended = '0';
  paintStrip(root, state, roster);
  const chipTarget = root.querySelector('[data-testid="target-chip"]');
  const target = state.targetSeatId ? seatById(state.targetSeatId, roster) : null;
  if (chipTarget) {
    chipTarget.textContent = target ? `To ${target.name}` : 'To the table';
  }
  const textarea = root.querySelector('[data-testid="composer-textarea"]');
  if (textarea) {
    const quoted = state.replyTo ? `Reply to ${state.replyTo.name}` : (target ? `Message ${target.name}` : 'Message the table');
    textarea.placeholder = `${quoted}…`;
  }
  const send = root.querySelector('[data-testid="composer-send"]');
  const busy = Boolean(model.sendLock) || state.phase.kickoff === 'running' || isBusy(state);
  if (send) {
    send.disabled = busy;
    send.textContent = model.sendLock ? 'Sending…' : 'Send';
  }
  void knights;
}
