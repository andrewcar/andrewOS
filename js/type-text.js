/**
 * Homepage header typewriter. A new call invalidates in-flight timers so leftover
 * letters from a previous string cannot prepend onto the next one.
 */
(function (global) {
  let generation = 0;

  function typeHeaderText(element, text, onComplete) {
    const myGeneration = ++generation;
    if (!element) return;

    element.innerHTML = '';
    const lines = String(text).split('<br>');
    let currentLine = 0;
    let currentChar = 0;

    for (let i = 0; i < lines.length; i++) {
      element.appendChild(document.createElement('div'));
    }

    function stillCurrent() {
      return myGeneration === generation;
    }

    function addCharacter() {
      if (!stillCurrent()) return;
      if (currentLine >= lines.length) return;

      const line = lines[currentLine];
      if (currentChar < line.length) {
        const lineEl = element.children[currentLine];
        if (!lineEl) return;
        const span = document.createElement('span');
        const ch = line[currentChar];
        if (ch === ' ') {
          span.innerHTML = '&nbsp;';
        } else {
          span.textContent = ch;
        }
        lineEl.appendChild(span);
        setTimeout(() => {
          if (!stillCurrent()) return;
          span.classList.add('show');
        }, 50);
        currentChar += 1;
        setTimeout(addCharacter, 69);
        return;
      }

      currentLine += 1;
      currentChar = 0;
      if (currentLine < lines.length) {
        setTimeout(addCharacter, 69);
        return;
      }
      if (typeof onComplete === 'function') {
        setTimeout(() => {
          if (!stillCurrent()) return;
          onComplete();
        }, 200);
      }
    }

    addCharacter();
  }

  function invalidateHeaderTypewriters() {
    generation += 1;
  }

  global.typeHeaderText = typeHeaderText;
  global.invalidateHeaderTypewriters = invalidateHeaderTypewriters;
})(typeof window !== 'undefined' ? window : globalThis);
