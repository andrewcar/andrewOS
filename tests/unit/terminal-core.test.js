import { describe, expect, it } from 'vitest';
import {
  ASK_NEED_QUESTION,
  HELP_COMMANDS,
  HELP_MESSAGE,
  LINK_RESPONSES,
  TYPED_RESPONSES,
  UNIX_DENIED,
  formatCommandList,
  isKnownHelpCommand,
  resolveCommand,
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
    expect(resolveCommand('ls')).toEqual({ kind: 'type', text: UNIX_DENIED });
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
    expect(HELP_MESSAGE).toContain('and vibecade');
    expect(isKnownHelpCommand('linkedin')).toBe(true);
    expect(isKnownHelpCommand('ask')).toBe(false);
  });
});
