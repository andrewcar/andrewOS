# Plan: test-infra

Set up Playwright UI + Vitest unit test infrastructure for andrewOS.

## Scope

Infrastructure only — no surface-specific tests yet (those are later todos). Include a minimal smoke placeholder so scripts are verifiable.

## Steps

1. Update `package.json`: type module, scripts (`test`, `test:ui`, `test:all`), `devDependencies` (vitest, @playwright/test, serve).
2. Add `vitest.config.js` pointing at `tests/unit/**/*.test.js`.
3. Add `playwright.config.js` with webServer (`npx serve . -p 4173`), Chromium desktop + iPhone viewport projects, screenshot artifacts dir.
4. Create folders: `tests/unit/`, `tests/ui/`, `tests/ui/artifacts/`, `tests/helpers/`.
5. Add pixel-sample helper `tests/helpers/samplePixels.js` (PNG RGB at normalized coords).
6. Add minimal placeholders: `tests/unit/smoke.test.js`, `tests/ui/smoke.spec.js` (home 200).
7. Update `.gitignore` for `tests/ui/artifacts/`, Playwright report/cache, node_modules if missing.
8. `npm install` + `npx playwright install chromium` + run `npm test` and `npm run test:ui`.

## Done when

- `npm test` and `npm run test:ui` both pass
- Folder layout and scripts match master plan
