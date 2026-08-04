---
name: andrewOS
overview: >-
  Full-site test coverage for andrewos.com (UI + unit, hearth-style
  evidence-based testing) plus a vibecade camera-panning sensitivity fix.
todos:
  - id: test-infra
    content: Set up test infrastructure (Playwright UI + Vitest unit, static server, npm scripts)
    status: completed
  - id: ui-test-home
    content: UI tests for the landing page (index.html)
    status: completed
  - id: ui-test-terminal
    content: UI tests for terminal.html
    status: completed
  - id: ui-test-static-pages
    content: UI tests for boredgames, ruleofthree, and docs assets
    status: completed
  - id: ui-test-vibe
    content: UI smoke tests for vibe (WebGL arcade)
    status: completed
  - id: unit-tests
    content: Unit tests for testable logic (terminal commands, api/ai.js)
    status: completed
  - id: vibe-pan-sensitivity
    content: Increase vibecade touch-pan camera sensitivity by 25% and redeploy bundle
    status: completed
---

# andrewOS Master Plan — Site-Wide Testing + Vibecade Panning Fix

## Overview

Two goals:

1. **Test the entire site.** Build a UI + unit test suite covering every surface
   of andrewos.com, following the same philosophy as the hearth project
   (`~/Developer/SwiftUI/hearth` and the `/test` skill): reproduce on a real
   runtime, screenshot, pixel-sample — never claim a visual result from code
   alone. Hearth's equivalent targets (`HearthTests`, `HearthKitTests`,
   `HearthUITests`) map here to Vitest unit tests and Playwright UI tests.
2. **Fix vibecade panning.** Touch-drag panning in the vibe arcade
   (andrewos.com/vibe) under-rotates the camera. Increase sensitivity ~25%.

## Site Inventory (what must be tested)

| Surface | Path | Notes |
|---------|------|-------|
| Landing page | `index.html` + `index.css` | ASCII art header, links, cream `#FAF4E8` background |
| Terminal | `terminal.html` | jquery.terminal-based; talks to OpenAI via `api/ai.js` |
| Vibe arcade | `vibe/` | Built Vite bundle (three.js). Source: `~/Developer/Front End/vibecade` |
| Bored Games pages | `boredgames/privacypolicy.html`, `boredgames/support.html` | Static |
| Rule of Three pages | `ruleofthree/privacypolicy.html`, `ruleofthree/support.html` | Static |
| Docs | `docs/cv.pdf`, `docs/privacyPolicy.txt` | Must serve 200 |
| API helper | `api/ai.js` | Small OpenAI wrapper |

## Testing Philosophy (hearth-style)

- **Evidence over narration.** Every UI claim is backed by a Playwright
  screenshot that is Read-inspected and, for contested colors/layout,
  pixel-sampled at concrete coordinates (e.g. landing background ≈ `#FAF4E8`).
- **Real runtime.** Tests run against a locally served copy of the site
  (static server), in a real browser via Playwright — desktop and mobile
  viewports.
- **Unit + UI in one suite.** `npm test` runs Vitest unit tests;
  `npm run test:ui` runs Playwright. Both must be green before `/log` or
  `/push`.

## Technical Specifications

### Todo: test-infra

- Add dev deps: `vitest`, `@playwright/test`, and a static server
  (`http-server` or Playwright's built-in `webServer` with `npx serve`).
- Folder layout:
  - `tests/unit/` — Vitest specs
  - `tests/ui/` — Playwright specs
  - `playwright.config.js` — `webServer` serving repo root on a local port,
    projects for desktop Chromium + iPhone viewport (touch enabled)
- npm scripts: `test` (unit), `test:ui` (Playwright), `test:all`.
- Screenshots output to `tests/ui/artifacts/` (gitignored).
- Add a small pixel-sampling helper (read PNG, assert RGB at normalized
  coordinates) mirroring hearth's `sample_pixels.swift` workflow.

### Todo: ui-test-home

- Page loads with no console errors or failed requests.
- ASCII art block renders; title is `andrewOS`.
- Every anchor on the page resolves (local links return 200; external links
  checked for `href` validity only).
- Pixel-sample body background ≈ `#FAF4E8`.
- Screenshot desktop + mobile viewport; Read-inspect both.

### Todo: ui-test-terminal

- Terminal boots (prompt visible), accepts input, echoes output.
- Built-in/local commands verified; OpenAI-backed responses mocked via
  Playwright route interception (never hit the live API key in tests).
- No console errors on load.

### Todo: ui-test-static-pages

- `boredgames` and `ruleofthree` privacy + support pages return 200, render
  headings, and their CSS loads.
- `docs/cv.pdf` and `docs/privacyPolicy.txt` return 200 with correct
  content types.

### Todo: ui-test-vibe

- `/vibe/` loads: canvas `.webgl` present, WebGL context created, bundle JS
  loads with no uncaught errors.
- After scene settle (~3s), screenshot and verify the frame is not a solid
  black/blank canvas (pixel variance check) — proves the three.js scene
  rendered.
- Mobile viewport: joystick/keyboard/perspective toggles visible per media
  query.

### Todo: unit-tests

- `api/ai.js`: unit-test the request-shaping logic with the OpenAI client
  mocked.
- Terminal command logic: if inline in `terminal.html`, extract the pure
  command-handling functions into a small module (e.g. `js/terminal-core.js`)
  loadable by both the page and Vitest, then test command parsing/dispatch.
- Keep extraction minimal — no behavior changes, verified by the terminal UI
  tests staying green.

### Todo: vibe-pan-sensitivity

- Source of truth: `~/Developer/Front End/vibecade/src/main.js` (~line 3039),
  touch-pan multiplier currently `0.004` for both axes:

```js
const movementX = (touchX - lastTouchX) * 0.004;
const movementY = (touchY - lastTouchY) * 0.004;
```

- Increase by 25% → `0.005` on both axes.
- Rebuild: `npm run build` in the vibecade repo (Vite, `base: '/vibe/'`,
  hashed output `assets/index.[hash].js`).
- Deploy into this repo: copy the new hashed bundle into `vibe/assets/` and
  update the `<script src>` hash in `vibe/index.html` (this file is
  hand-customized — do NOT overwrite it wholesale with dist/index.html).
  Remove superseded old hashed bundles.
- Verify with a Playwright touch test: synthetic touch-drag on the right half
  of the screen, assert the camera rotation delta is ~25% larger than the old
  multiplier would give (or snapshot-compare rendered heading before/after
  drag).

## Project Structure Notes

- This is a static site (GitHub Pages, `CNAME` present) — no build step for
  the root site; tests must serve files as-is.
- `vibe/` is build output only; never edit its JS bundles by hand except for
  the documented hash swap during deploy.
- Existing `package.json` is minimal (`jquery.terminal`, `openai`); test
  tooling goes in `devDependencies`.
