# Plan: ui-test-vibe

UI smoke tests for `/vibe/` (WebGL arcade).

## Scope

- Load `/vibe/`: `.webgl` canvas present, WebGL context created, hashed JS bundle 200
- No uncaught page errors (filter expected third-party/socket noise if needed)
- Wait ~3s for scene settle; screenshot; pixel variance proves frame is not solid black
- Mobile project: `.keyboard-toggle` and `.perspective-toggle` visible (CSS `@media max-width: 768px`)

## Steps

1. Add `tests/ui/vibe.spec.js` (+ optional `pixelVariance` helper)
2. Run Playwright both projects; save screenshots to `ai/logs/5/screenshots/`
3. Read-inspect screenshots; log

## Done when

`npx playwright test tests/ui/vibe.spec.js` passes desktop + mobile.
