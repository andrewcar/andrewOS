import { describe, expect, it } from 'vitest';
import {
  ASK_HELP,
  ASK_NEED_QUESTION,
  HELP_COMMANDS,
  HELP_MESSAGE,
  LINK_RESPONSES,
  TYPED_RESPONSES,
  UNIX_DENIED,
  ASCII_BANNER,
  bootLinesForWidth,
  chunkAnswer,
  formatCommandList,
  isKnownHelpCommand,
  resolveCommand,
  shellPrompt,
} from '../../js/terminal-core.js';

describe('formatCommandList', () => {
  it('joins with commas and a final and', () => {
    expect(formatCommandList(['a', 'b', 'c'])).toBe('a, b and c');
  });
});

describe('resolveCommand', () => {
  it('resolves typed local commands', () => {
    expect(resolveCommand('hello')).toEqual({ kind: 'type', text: TYPED_RESPONSES.hello });
    expect(resolveCommand('name')).toEqual({ kind: 'type', text: '\nAndrew Carvajal\n' });
    expect(resolveCommand('HELP')).toEqual({ kind: 'type', text: HELP_MESSAGE });
  });

  it('resolves link echo commands', () => {
    expect(resolveCommand('github')).toEqual({ kind: 'echo', text: LINK_RESPONSES.github });
    expect(resolveCommand('cv').text).toContain('cv.pdf');
  });

  it('resolves ask with and without a question', () => {
    expect(resolveCommand('ask')).toEqual({ kind: 'type', text: ASK_NEED_QUESTION });
    expect(resolveCommand('ask', ['what', 'is', 'life'])).toEqual({
      kind: 'ask',
      question: 'what is life',
    });
  });

  it('resolves clear / exit / vibecade / unix denials', () => {
    expect(resolveCommand('clear')).toEqual({ kind: 'clear' });
    expect(resolveCommand('exit')).toEqual({ kind: 'exit' });
    expect(resolveCommand('vibecade')).toEqual({ kind: 'vibecade' });
    expect(resolveCommand('vim')).toEqual({ kind: 'type', text: UNIX_DENIED });
    expect(resolveCommand('mkdir')).toEqual({ kind: 'type', text: UNIX_DENIED });
  });

  it('lists and changes the fake filesystem', () => {
    const root = resolveCommand('ls');
    expect(root.text).toContain('projects/');
    expect(root.text).toContain('apps/');
    expect(root.text).toContain('social/');
    expect(root.text).toContain('littlefly/');
    expect(root.text).toContain('feedback');
    expect(resolveCommand('cd', ['projects'])).toEqual({ kind: 'cd', cwd: '/projects' });
    expect(resolveCommand('ls', [], { cwd: '/projects' }).text).toContain('andrewos.txt');
    expect(resolveCommand('cat', ['feedback']).text).toMatch(/feedback form/i);
    expect(resolveCommand('open', ['feedback'])).toMatchObject({ kind: 'navigate', href: '/feedback' });
    expect(resolveCommand('open', ['littlefly'])).toMatchObject({
      kind: 'navigate',
      href: '/littleflywholeworld',
    });
    expect(resolveCommand('pwd', [], { cwd: '/social' }).text).toContain('~/social');
  });

  it('shares one identity panel and keeps the old aliases', () => {
    expect(resolveCommand('whoami').text).toContain('Andrew Carvajal');
    expect(resolveCommand('neofetch').text).toContain('andrew.carvajal@me.com');
    expect(resolveCommand('whoami').text).toBe(resolveCommand('neofetch').text);
    expect(resolveCommand('name').text).toContain('Andrew Carvajal');
    expect(resolveCommand('email').text).toContain('andrew.carvajal@me.com');
    expect(resolveCommand('phone').text).toContain('(954) 292-5454');
    expect(resolveCommand('dob').text).toContain('April 26, 1990');
    expect(shellPrompt('/')).toBe('guest@andrewos:~$ ');
    expect(shellPrompt('/projects')).toBe('guest@andrewos:~/projects$ ');
    expect(ASCII_BANNER).toContain('▄▄█▀▀██');
    expect(ASCII_BANNER).toContain('//// Build 302 ////');
    expect(bootLinesForWidth(390)).toEqual([]);
    expect(bootLinesForWidth(1200)[0]).toBe('andrewOS');
    expect(bootLinesForWidth(1200).length).toBeGreaterThan(2);
  });

  it('documents ask and chunks a one-shot reply', () => {
    expect(resolveCommand('ask', ['--help'])).toEqual({ kind: 'echo', text: ASK_HELP });
    expect(ASK_HELP).toMatch(/chunk/i);
    expect(chunkAnswer('one two three four five', 10).join('')).toBe('one two three four five');
    expect(chunkAnswer('one two three four five', 10).length).toBeGreaterThan(1);
  });

  it('returns unknown for empty or unrecognized names', () => {
    expect(resolveCommand('')).toEqual({ kind: 'unknown' });
    expect(resolveCommand('nope')).toEqual({ kind: 'unknown', name: 'nope' });
  });
});

describe('help catalog', () => {
  it('lists the advertised help commands', () => {
    expect(HELP_COMMANDS).toContain('boredgames');
    expect(HELP_COMMANDS).toContain('vibecade');
    expect(HELP_MESSAGE).toContain('boredgames');
    expect(HELP_MESSAGE).toContain('vibecade');
    expect(HELP_MESSAGE).toContain('whoami');
    expect(isKnownHelpCommand('linkedin')).toBe(true);
    expect(isKnownHelpCommand('ask')).toBe(true);
    expect(isKnownHelpCommand('vim')).toBe(false);
  });
});
