# Plan: ui-test-terminal

UI tests for `terminal.html` per master plan.

## Scope

- Load `/terminal.html`: terminal boots, greetings / Build banner visible, cmd input present
- No unexpected console errors on load
- Built-in commands: `hello` → “Hello back.”; `help` → command list; `name` → “Andrew Carvajal”
- `ask` with Playwright route mock for `/api/ai` (never hits live OpenAI)
- Screenshot desktop + mobile → `ai/logs/3/screenshots/`

## Fix required for ask mock

`ask()` awaits fetch but does not return `data.result`, so typed answers are always `undefined`. Fix return path so the mocked response is echoed (minimal, test-enabling).

## Steps

1. Fix `ask()` in `terminal.html` to return the API result
2. Add `tests/ui/terminal.spec.js`
3. Run Playwright; screenshot + inspect
4. Log results

## Done when

- `npx playwright test tests/ui/terminal.spec.js` passes both projects
- Mocked `ask` echoes mock payload
