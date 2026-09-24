/**
 * Homepage → terminal swap. Same path the ASCII mark has always used:
 * history shows /terminal, document is replaced with terminal.html.
 * Modified clicks return so a real href can open in a new tab.
 */
async function openAndrewTerminal(event) {
  if (event) {
    const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    const aux = typeof event.button === 'number' && event.button !== 0;
    if (modified || aux) return;
    if (typeof event.preventDefault === 'function') event.preventDefault();
  }

  window.history.pushState({}, '', '/terminal');
  const response = await fetch('/terminal.html');
  const html = await response.text();
  document.documentElement.innerHTML = html;

  await new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://code.jquery.com/jquery-3.3.1.min.js';
    script.onload = resolve;
    document.head.appendChild(script);
  });
  await new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/jquery.terminal/js/jquery.terminal.min.js';
    script.onload = resolve;
    document.head.appendChild(script);
  });

  const scripts = document.getElementsByTagName('script');
  for (let script of scripts) {
    if (!script.src) {
      eval(script.innerHTML);
    }
  }
}
