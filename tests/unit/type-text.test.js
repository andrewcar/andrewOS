import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../js/type-text.js';

function makeElement(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    children: [],
    textContent: '',
    classList: {
      add() {},
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
  };
  let html = '';
  Object.defineProperty(el, 'innerHTML', {
    get() {
      return html;
    },
    set(value) {
      html = value;
      if (value === '') el.children.length = 0;
    },
  });
  return el;
}

function headerText(el) {
  return el.children
    .map((line) =>
      [...line.children]
        .map((span) => (span.innerHTML === '&nbsp;' ? ' ' : span.textContent))
        .join('')
    )
    .join('\n');
}

describe('typeHeaderText', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.document = {
      createElement: (tag) => makeElement(tag),
    };
    globalThis.invalidateHeaderTypewriters();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('types two lines', async () => {
    const header = makeElement('h1');
    globalThis.typeHeaderText(header, "Thanks!<br>I'll be in touch.");
    await vi.runAllTimersAsync();
    expect(headerText(header)).toBe("Thanks!\nI'll be in touch.");
  });

  it('drops leftover letters when a new string starts mid-type', async () => {
    const header = makeElement('h1');
    globalThis.typeHeaderText(header, "Let's build<br>something.");
    await vi.advanceTimersByTimeAsync(1100);
    globalThis.typeHeaderText(header, "Thanks!<br>I'll be in touch.");
    await vi.runAllTimersAsync();
    expect(headerText(header)).toBe("Thanks!\nI'll be in touch.");
    expect(headerText(header)).not.toMatch(/h\.I|thing\.I|something/i);
  });

  it('does not run onComplete from a cancelled animation', async () => {
    const header = makeElement('h1');
    const firstDone = vi.fn();
    const secondDone = vi.fn();
    globalThis.typeHeaderText(header, "Let's build<br>something.", firstDone);
    globalThis.typeHeaderText(header, "Thanks!<br>I'll be in touch.", secondDone);
    await vi.runAllTimersAsync();
    expect(firstDone).not.toHaveBeenCalled();
    expect(secondDone).toHaveBeenCalledTimes(1);
  });
});
