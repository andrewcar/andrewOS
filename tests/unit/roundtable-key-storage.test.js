import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryStorage, createVault } from '../../roundtable/js/auth.js';
import {
  CHECKING_PASSWORD_NOTE,
  KEY_REMOVED_NOTE,
  KEY_UNLOCK_PROMPT,
  KEYS_CLEARED_NOTE,
  KEYS_LOCKED_NOTE,
  KEYS_READY_NOTE,
  KEYS_SAVED_NOTE,
  KEYS_UNLOCKED_NOTE,
  collectKeyEdits,
  removeProviderKey,
  saveProviderKeys,
  saveResultNote,
} from '../../roundtable/js/key-storage.js';
import { ROSTER } from '../../roundtable/js/roster.js';
import { arbiterSettingsCopy } from '../../roundtable/js/ui.js';

const PASSWORD = 'correct-horse';

function setup() {
  const storage = createMemoryStorage();
  const session = createMemoryStorage();
  const vault = createVault({ storage, session, iterations: 1200 });
  return { storage, session, vault };
}

async function signUp(vault) {
  return vault.signUp({ email: 'Ada@Example.com', password: PASSWORD, name: 'Ada' });
}

function persisted(storage, session) {
  return JSON.stringify(storage.dump()) + JSON.stringify(session.dump());
}

describe('settings key storage after a restored session', () => {
  it('keeps the AES key out of the session record', async () => {
    const { vault } = setup();
    const created = await signUp(vault);
    expect(vault.session()).toEqual({
      userId: created.account.id,
      email: 'ada@example.com',
      name: 'Ada',
    });
    expect(vault.session()).not.toHaveProperty('aesKey');
    expect(JSON.stringify(vault.session())).not.toContain(PASSWORD);
  });

  it('saves the first key after restore by deriving the key from the password', async () => {
    const { storage, session, vault } = setup();
    const created = await signUp(vault);
    const unlock = vi.spyOn(vault, 'unlock');
    const saved = await saveProviderKeys({
      vault,
      userId: created.account.id,
      aesKey: null,
      secrets: {},
      password: PASSWORD,
      edits: collectKeyEdits([['openai', '  sk-test-openai  ']]),
    });
    expect(unlock).toHaveBeenCalledTimes(1);
    expect(unlock).toHaveBeenCalledWith(PASSWORD);
    expect(saved.unlockedNow).toBe(true);
    expect(saved.secrets).toEqual({ openai: 'sk-test-openai' });
    expect(saveResultNote(saved)).toBe(KEYS_SAVED_NOTE);
    expect(vault.hasSecrets(created.account.id)).toBe(true);
    const dump = persisted(storage, session);
    expect(dump).not.toContain(PASSWORD);
    expect(dump).not.toContain('sk-test-openai');
    const signedIn = await vault.signIn({ email: 'ada@example.com', password: PASSWORD });
    expect(signedIn.secrets).toEqual({ openai: 'sk-test-openai' });
  });

  it('merges a later save after restore and ignores the stale empty secret map', async () => {
    const { storage, session, vault } = setup();
    const created = await signUp(vault);
    await vault.saveSecrets(created.account.id, created.aesKey, { openai: 'sk-test-old' });
    const saved = await saveProviderKeys({
      vault,
      userId: created.account.id,
      aesKey: null,
      secrets: { openai: 'sk-stale' },
      password: PASSWORD,
      edits: { anthropic: 'sk-test-anthropic', openai: 'sk-test-new' },
    });
    expect(saved.secrets).toEqual({
      openai: 'sk-test-new',
      anthropic: 'sk-test-anthropic',
    });
    expect(saveResultNote(saved)).toBe(KEYS_SAVED_NOTE);
    const dump = persisted(storage, session);
    expect(dump).not.toContain(PASSWORD);
    expect(dump).not.toContain('sk-test-old');
    expect(dump).not.toContain('sk-test-new');
    expect(dump).not.toContain('sk-stale');
    expect(dump).not.toContain('sk-test-anthropic');
    const signedIn = await vault.signIn({ email: 'ada@example.com', password: PASSWORD });
    expect(signedIn.secrets).toEqual(saved.secrets);
  });

  it('rejects a missing or wrong password without writing', async () => {
    const { storage, vault } = setup();
    const created = await signUp(vault);
    await vault.saveSecrets(created.account.id, created.aesKey, { openai: 'sk-test-old' });
    const before = storage.dump();
    await expect(saveProviderKeys({
      vault,
      userId: created.account.id,
      aesKey: null,
      secrets: {},
      password: '',
      edits: { openai: 'sk-test-new' },
    })).rejects.toThrow(KEY_UNLOCK_PROMPT);
    await expect(removeProviderKey({
      vault,
      userId: created.account.id,
      aesKey: null,
      secrets: {},
      password: '',
      providerId: 'openai',
    })).rejects.toThrow(KEY_UNLOCK_PROMPT);
    await expect(saveProviderKeys({
      vault,
      userId: created.account.id,
      aesKey: null,
      secrets: {},
      password: 'wrong-password',
      edits: { openai: 'sk-test-new' },
    })).rejects.toThrow(/wrong password/i);
    await expect(removeProviderKey({
      vault,
      userId: created.account.id,
      aesKey: null,
      secrets: {},
      password: 'wrong-password',
      providerId: 'openai',
    })).rejects.toThrow(/wrong password/i);
    expect(storage.dump()).toEqual(before);
    const signedIn = await vault.signIn({ email: 'ada@example.com', password: PASSWORD });
    expect(signedIn.secrets).toEqual({ openai: 'sk-test-old' });
  });

  it('does not ask the vault for the password when the AES key is already in memory', async () => {
    const { vault } = setup();
    const created = await signUp(vault);
    const unlock = vi.spyOn(vault, 'unlock');
    const saved = await saveProviderKeys({
      vault,
      userId: created.account.id,
      aesKey: created.aesKey,
      secrets: { openai: 'sk-test-old' },
      password: '',
      edits: { google: 'sk-test-google' },
    });
    expect(unlock).not.toHaveBeenCalled();
    expect(saved.unlockedNow).toBe(false);
    expect(saved.secrets).toEqual({ openai: 'sk-test-old', google: 'sk-test-google' });
    expect(saveResultNote(saved)).toBe(KEYS_SAVED_NOTE);
  });

  it('unlocks existing keys without writing an empty blob when nothing was edited', async () => {
    const { vault } = setup();
    const created = await signUp(vault);
    const empty = await saveProviderKeys({
      vault,
      userId: created.account.id,
      aesKey: null,
      secrets: {},
      password: PASSWORD,
      edits: { openai: '   ' },
    });
    expect(empty.saved).toBe(false);
    expect(vault.hasSecrets(created.account.id)).toBe(false);
    expect(saveResultNote(empty)).toBe(KEYS_READY_NOTE);

    await vault.saveSecrets(created.account.id, created.aesKey, { openai: 'sk-test-old' });
    const unlocked = await saveProviderKeys({
      vault,
      userId: created.account.id,
      aesKey: null,
      secrets: {},
      password: PASSWORD,
      edits: {},
    });
    expect(unlocked.secrets).toEqual({ openai: 'sk-test-old' });
    expect(saveResultNote(unlocked)).toBe(KEYS_UNLOCKED_NOTE);
  });

  it('removes one key after restore and clears the blob when the last key is gone', async () => {
    const { vault } = setup();
    const created = await signUp(vault);
    await vault.saveSecrets(created.account.id, created.aesKey, {
      openai: 'sk-test-openai',
      anthropic: 'sk-test-anthropic',
    });
    const removed = await removeProviderKey({
      vault,
      userId: created.account.id,
      aesKey: null,
      secrets: {},
      password: PASSWORD,
      providerId: 'anthropic',
    });
    expect(removed.secrets).toEqual({ openai: 'sk-test-openai' });
    expect(vault.hasSecrets(created.account.id)).toBe(true);
    const cleared = await removeProviderKey({
      vault,
      userId: created.account.id,
      aesKey: removed.aesKey,
      secrets: removed.secrets,
      password: '',
      providerId: 'openai',
    });
    expect(cleared.secrets).toEqual({});
    expect(vault.hasSecrets(created.account.id)).toBe(false);
    const signedIn = await vault.signIn({ email: 'ada@example.com', password: PASSWORD });
    expect(signedIn.secrets).toEqual({});
  });

  it('keeps settings copy white-label and points at the inline unlock', () => {
    const notes = [
      KEY_UNLOCK_PROMPT,
      KEYS_LOCKED_NOTE,
      CHECKING_PASSWORD_NOTE,
      KEYS_SAVED_NOTE,
      KEYS_UNLOCKED_NOTE,
      KEYS_READY_NOTE,
      KEY_REMOVED_NOTE,
      KEYS_CLEARED_NOTE,
    ];
    for (const note of notes) expect(note).not.toMatch(/BotBot|___Bot/);
    expect(KEY_UNLOCK_PROMPT).toBe('Enter your password to unlock key storage.');
    expect(arbiterSettingsCopy({ arbiterId: 'claude' }, ROSTER, {}, true))
      .toBe('Claude is the arbiter. Saved keys are locked. Enter your password to unlock key storage.');
    expect(arbiterSettingsCopy({ arbiterId: 'claude' }, ROSTER, {}, false))
      .toContain('has no key yet');
    expect(arbiterSettingsCopy({ arbiterId: 'botbot' }, ROSTER, { arbiter: 'present' }, false))
      .toContain('Grok (API)');
    expect(arbiterSettingsCopy({ arbiterId: 'botbot' }, ROSTER, {}, true)).not.toMatch(/BotBot|___Bot/);

    const app = readFileSync('roundtable/js/app.js', 'utf8');
    const ui = readFileSync('roundtable/js/ui.js', 'utf8');
    expect(app).not.toContain('Unlock from the table');
    expect(ui).not.toContain('Unlock from the table');
    expect(ui).toContain('KEY_UNLOCK_PROMPT');
    expect(ui).toContain('data-testid="settings-password"');
    expect(app).toContain('saveProviderKeys');
    expect(app).toContain('removeProviderKey');
    expect(app).toContain('vault.unlock');
  });
});
