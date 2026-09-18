/**
 * Homepage madlib suggestions for "I want to build X that Y."
 * Keep pairs complete (no empty stubs). Picker uses the full list length.
 */
(function (global) {
  const MADLIB_PLACEHOLDERS = [
    ['a weird website', 'helps people flirt with AI'],
    ['a talking button', 'writes code while you nap'],
    ['a haunted fridge', 'texts you when the milk gives up'],
    ['a pocket arcade', 'high-scores your grocery list'],
    ['a polite virus', 'only crashes boring meetings'],
    ['a frog GPS', 'ribbits you away from traffic'],
    ['a midnight radio', 'DJs songs you forgot you loved'],
    ['a cursed toaster', 'burns only the bread you wanted'],
    ['a doorbell', 'screens guests with trivia'],
    ['a plant cam', 'guilt-trips you in haiku'],
    ['a tiny OS', 'hides your tabs from your boss'],
    ['a paperclip with opinions', 'files taxes in Comic Sans'],
  ];

  function pickMadlibPlaceholderIndex(random = Math.random) {
    const n = MADLIB_PLACEHOLDERS.length;
    if (n === 0) return 0;
    return Math.min(n - 1, Math.floor(Number(random()) * n));
  }

  function pickMadlibPlaceholder(random = Math.random) {
    return MADLIB_PLACEHOLDERS[pickMadlibPlaceholderIndex(random)];
  }

  global.MADLIB_PLACEHOLDERS = MADLIB_PLACEHOLDERS;
  global.pickMadlibPlaceholderIndex = pickMadlibPlaceholderIndex;
  global.pickMadlibPlaceholder = pickMadlibPlaceholder;
})(typeof window !== 'undefined' ? window : globalThis);
