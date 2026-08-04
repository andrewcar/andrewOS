# Implementation Log: ui-test-home

**Date:** 2026-08-03  
**Todo:** `ui-test-home`  
**Status:** completed

## What was implemented

- `tests/ui/home.spec.js` — landing page UI suite (desktop + mobile Chromium)
  - Title `andrewOS`, ASCII art visible/non-empty
  - No console errors / no failed local requests (Ko-fi overlay stubbed)
  - All `<a href>` anchors checked (local → 200, external → valid URL)
  - Favicon `/favicon.png` → 200
  - Waits for typewriter header + madlib/button `fade-in`
  - Full-page screenshots → `ai/logs/2/screenshots/`
  - Pixel-sample body background ≈ `#FAF4E8` via `samplePixels` / `assertColorNear`

## Test results

```
nvm use 20
npx playwright test tests/ui/home.spec.js   # 2 passed
npm run test:all                            # Vitest 2 + Playwright 4 passed
```

### Screenshot evidence

| File | Observations |
|------|----------------|
| `ai/logs/2/screenshots/home-desktop-chromium.png` | Cream bg, pixel andrewOS ASCII, “Let’s build / something.”, madlib inputs, Send button, X link |
| `ai/logs/2/screenshots/home-mobile-chromium.png` | Same composition stacked for iPhone viewport |

### Pixel samples

Both screenshots `body-bg` / corners: `rgb(250,244,232)` = `#FAF4E8` (±0).

## Notes

- Header typewriter uses `&nbsp;`, so assertions avoid requiring a regular space between words
- Ko-fi `overlay-widget.js` is stubbed in `beforeEach` to keep loads deterministic
