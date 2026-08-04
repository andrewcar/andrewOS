# Implementation Log: test-infra

**Date:** 2026-08-03  
**Todo:** `test-infra`  
**Status:** completed

## What was implemented

- `package.json`: ESM (`"type": "module"`), `engines.node >= 20`, scripts `test` / `test:ui` / `test:all`, devDeps `@playwright/test`, `vitest`, `serve`, `pngjs`
- `.nvmrc` pinned to Node 20 (Playwright/Vitest require ≥20; default shell was Node 16)
- `vitest.config.js` — includes `tests/unit/**/*.test.js`
- `playwright.config.js` — `serve` on `:4173`, projects `desktop-chromium` + `mobile-chromium` (iPhone 14 viewport / touch; Chromium to avoid a separate WebKit download)
- `tests/helpers/samplePixels.js` — PNG RGB sampling + `assertColorNear` (hearth-style)
- Placeholders: `tests/unit/smoke.test.js`, `tests/ui/smoke.spec.js`
- `.gitignore` for artifacts, Playwright report/cache, `.env`, `node_modules`

## Test results

```
nvm use 20
npm run test:all
```

- Vitest: 2 passed (`runs vitest`, `samplePixels reads RGB…`)
- Playwright: 2 passed (desktop + mobile smoke — site root / title `andrewOS`)

## Notes / follow-ups

- Run tests under Node 20+: `nvm use` (reads `.nvmrc`)
- Mobile project uses Chromium with iPhone 14 device metrics, not WebKit
- `postinstall` runs `playwright install chromium` so browsers land in `~/Library/Caches/ms-playwright` (agent sandbox installs are not shared with the host shell)
- Surface-specific UI/unit coverage is later todos (`ui-test-home`, etc.)
