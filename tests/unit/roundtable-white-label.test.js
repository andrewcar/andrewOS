import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Public Round Table markup shipped to the browser.
 * Connector docs and the Worker are out of this scan; seat ids such as
 * `botbot` are internal keys and are not display copy.
 */
const MARKUP_PATHS = [
  'roundtable/index.html',
  'roundtable/site.webmanifest',
  'roundtable/styles.css',
  ...readdirSync('roundtable/js')
    .filter((name) => name.endsWith('.js'))
    .map((name) => join('roundtable/js', name)),
];

/** Case-sensitive fleet names so the seat id `botbot` is not a false positive. */
const FLEET_NAME = /BotBot|___Bot|CodexBot|ClaudeBot|GeminiBot|MuseBot|DeepSeekBot|Grok Bot|andrewOS admin/;
const INFRA_NAME = /hearth|relay\.andrewos\.com/i;

function internalHit(text) {
  return text.match(INFRA_NAME)?.[0] || text.match(FLEET_NAME)?.[0] || null;
}

describe('round table public copy', () => {
  it('keeps user-facing markup free of internal fleet and infra names', () => {
    const hits = [];
    for (const path of MARKUP_PATHS) {
      const text = readFileSync(path, 'utf8');
      const match = internalHit(text);
      if (match) hits.push(`${path}: ${match}`);
    }
    expect(hits).toEqual([]);
  });

  it('still describes the missing Muse browser path in generic language', () => {
    const ui = readFileSync('roundtable/js/ui.js', 'utf8');
    expect(ui).toContain('Muse has no browser relay');
    expect(ui).not.toContain('Hearth admin relay');
    expect(ui).not.toContain('relay.andrewos.com');
  });
});
