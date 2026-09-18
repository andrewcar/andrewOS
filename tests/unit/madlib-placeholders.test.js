import { describe, expect, it } from 'vitest';
import '../../js/madlib-placeholders.js';

const { MADLIB_PLACEHOLDERS, pickMadlibPlaceholder, pickMadlibPlaceholderIndex } = globalThis;

describe('madlib placeholders', () => {
  it('has at least eight complete funny/cool pairs', () => {
    expect(MADLIB_PLACEHOLDERS.length).toBeGreaterThanOrEqual(8);
    for (const pair of MADLIB_PLACEHOLDERS) {
      expect(pair).toHaveLength(2);
      expect(pair[0].trim()).not.toBe('');
      expect(pair[1].trim()).not.toBe('');
    }
  });

  it('keeps the original two suggestions', () => {
    expect(MADLIB_PLACEHOLDERS).toContainEqual(['a weird website', 'helps people flirt with AI']);
    expect(MADLIB_PLACEHOLDERS).toContainEqual(['a talking button', 'writes code while you nap']);
  });

  it('can pick the last index when random is just under 1', () => {
    const last = MADLIB_PLACEHOLDERS.length - 1;
    expect(pickMadlibPlaceholderIndex(() => 0.999999)).toBe(last);
    expect(pickMadlibPlaceholder(() => 0.999999)).toEqual(MADLIB_PLACEHOLDERS[last]);
  });

  it('picks the first pair when random is 0', () => {
    expect(pickMadlibPlaceholderIndex(() => 0)).toBe(0);
    expect(pickMadlibPlaceholder(() => 0)).toEqual(MADLIB_PLACEHOLDERS[0]);
  });
});
