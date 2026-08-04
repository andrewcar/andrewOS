# Plan: unit-tests

Unit tests for `api/ai.js` request shaping and terminal command dispatch.

## Scope

1. Extract pure AI helpers to `api/completion.js`; keep `api/ai.js` as thin OpenAI-wired handler
2. Extract command catalog + `resolveCommand` / help text to `js/terminal-core.js`
3. Wire `terminal.html` to import `js/terminal-core.js` (module) — same responses, no behavior change
4. Vitest: `tests/unit/completion.test.js`, `tests/unit/terminal-core.test.js`
5. Confirm `npm test` and terminal UI tests still pass

## Done when

- Unit tests green for completion params + command resolve/dispatch
- `npx playwright test tests/ui/terminal.spec.js` still green
