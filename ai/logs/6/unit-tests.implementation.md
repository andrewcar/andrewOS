# Implementation Log: unit-tests

**Date:** 2026-08-03  
**Todo:** `unit-tests`  
**Status:** completed

## What was implemented

- `api/completion.js` — pure `buildCompletionRequest`, `extractCompletionText`, `handleAiRequest`
- `api/ai.js` — thin OpenAI-wired default export using `handleAiRequest`
- `js/terminal-core.js` — command catalog + `resolveCommand` / help formatting
- `terminal.html` — loads core via dynamic `import()`, builds handlers from catalog; awaits `startTerminal()` before MutationObserver (fixes race)
- Unit tests: `tests/unit/completion.test.js`, `tests/unit/terminal-core.test.js`
- `tests/ui/vibe.spec.js` — `goto` uses `waitUntil: 'domcontentloaded'` (page never reaches `load` with open sockets)

## Test results

```
npm test
# 13 passed (smoke 2 + completion 4 + terminal-core 7)

npx playwright test tests/ui/terminal.spec.js tests/ui/vibe.spec.js
# 4 passed
```

## Notes

- Typed/link/`help`/`ask`/`clear` dispatch through `resolveCommand`; exit/vibecade/lola/etc. remain page-side
- Greetings help text now comes from `HELP_MESSAGE` (same command list as before)
