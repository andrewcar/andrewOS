# Session handoff: Vibecade coin HUD + polish (2026-08-03)

> **Superseded for pickup.** Start here: `ai/web/logs/2026-09-18-thank-you-typewriter-handoff.md`. This note remains the vibecade coin-HUD record. Continues/supersedes `ai/web/logs/2026-08-03-vibecade-portal-font-debug-handoff.md` (and transitively play-ux). User confirmed coin heights **fixed** after canvas raster approach. Not committed — dirty `main` on andrewos; vibecade source is a separate repo at `~/Developer/Front End/vibecade` (v1.0.40).

---

## Status at a glance

| Area | Status |
|------|--------|
| Play UX (CLICK TO START / ESC / pointer lock / look / FPS+coin HUD / perf) | **Done** — still live |
| Self-hosted Press Start 2P + portal label resize | **Done** — `vibe/fonts/press-start-2p.woff2`, `@font-face`, `FontFace` load, `paintPortalLabel()` |
| Safari look feel | **Done** — `SAFARI_LOOK_BOOST = 2.6` (user OK); accept Safari FPS for now |
| LOOK °/s + FPS traffic-light HUD + browser badge | **Done** — `vibecade/src/wallet.js` |
| Coin emoji height vs digit “0” (Safari + Firefox) | **Done** — canvas rasterize + crop-scale; user confirmed fixed |
| Debug instrumentation | **None added** this session (no agent-log regions in product code) |
| Tests | **Passed** — `npx playwright test tests/ui/vibe.spec.js --grep "coin value"` on desktop-chromium, desktop-firefox, desktop-webkit, mobile-chromium. Ink verify: digit≈21 / coin≈22 (Δ1) all three desktop engines. Hearth `/test` N/A (iOS). |
| Git commit / PR | **Not done** |

**Active bundle:** `andrewos/vibe/assets/index.6c8d6b3f.js` ← script in `andrewos/vibe/index.html`. Vibecade `package.json` **1.0.40**.

---

## What shipped (since portal-font handoff)

### 1. Fonts + portal clip (earlier in thread; still live)

- Self-host Press Start 2P under `andrewos/vibe/fonts/` + `@font-face` / preload `crossorigin` in `vibe/index.html` (and vibecade HTML).
- Explicit `FontFace` + `document.fonts.load` in `vibecade/src/main.js`.
- `paintPortalLabel()` — dynamic canvas width from measured text; redraw after fonts ready.

### 2. LOOK / FPS HUD + Safari look

- Top-right: `LOOK` (°/s) · `FPS` · coins — traffic-light colors.
- Top-left: browser icon + short name/version.
- `DESKTOP_LOOK_SENSITIVITY = 0.005`, `SAFARI_LOOK_BOOST = 2.6`.
- In-world version label from `package.json` (`arcade.js`).

### 3. Coin icon — final approach (do not revert to font-size factors)

**Problem:** CSS `font-size` on 🪙 ≠ painted ink height. Per-engine paint factors + canvas emoji “measure” lied (Playwright FF ≠ real macOS FF; Safari WebKit digit `actualBoundingBox*` = full em). SVG replacement was rejected earlier — keep real 🪙.

**Solution (current):**

1. Measure digit ink via **canvas pixel scan** of Press Start `"0"` (not metrics-first).
2. `rasterizeCoinEmoji()` — draw 🪙 on offscreen canvas, find alpha AABB.
3. Draw cropped emoji into `#coin-hud-canvas` with CSS height = digit ink height (DPR-aware).
4. Fallback: hide canvas, show `#coin-hud-glyph` with factor only if rasterization fails.

Key IDs: `#coin-hud-value`, `#coin-hud-icon`, `#coin-hud-canvas`, `#coin-hud-glyph` (hidden when canvas works).

### 4. Tests

- `tests/helpers/samplePixels.js` — `inkBounds` + `looksClipped` (corner ink / aspect).
- `tests/ui/vibe.spec.js` — coin ink height / circular / not clipped; black pad on icon before screenshot.
- `playwright.config.js` — `desktop-chromium`, `desktop-firefox`, `desktop-webkit`, `mobile-chromium`.

---

## Files touched (pickup-relevant)

| Path | What |
|------|------|
| `~/Developer/Front End/vibecade/src/wallet.js` | HUD, browser badge, `rasterizeCoinEmoji` / `fitCoinIconToDigit` |
| `~/Developer/Front End/vibecade/src/main.js` | Look boost, fonts, portal label, play UX |
| `~/Developer/Front End/vibecade/src/arcade.js` | Version from package.json |
| `~/Developer/Front End/vibecade/package.json` | **1.0.40** |
| `andrewos/vibe/assets/index.6c8d6b3f.js` | Deployed bundle |
| `andrewos/vibe/index.html` | Script hash + `@font-face` / preload |
| `andrewos/vibe/fonts/press-start-2p.woff2` | Self-hosted font |
| `andrewos/tests/ui/vibe.spec.js` | Coin regression |
| `andrewos/tests/helpers/samplePixels.js` | Ink / clip helpers |
| `andrewos/playwright.config.js` | Firefox + WebKit projects |

Deploy path (unchanged): vibecade `npm run build` → copy `dist/assets/index.*.js` → `andrewos/vibe/assets/` → update **only** script hash in `andrewos/vibe/index.html`.

---

## Open / next

1. **`/push`** when asked — commit andrewos + vibecade separately; skip `node_modules`, `.cursor/debug-*.log`.
2. Optional: mobile look sensitivity polish (deferred).
3. Optional: tone down `#lock-warning` if still loud in embeds.
4. Do **not** replace 🪙 with SVG unless user asks.
5. Do **not** reintroduce per-browser emoji font-size paint-factor guessing for sizing — canvas raster is the source of truth.

---

## Prompt for next chat

> Read `ai/web/logs/2026-08-03-vibecade-coin-hud-handoff.md`. Coin HUD is **fixed** via canvas rasterize+scale (`#coin-hud-canvas`); live bundle `vibe/assets/index.6c8d6b3f.js` (vibecade **1.0.40**). Fonts self-hosted; Safari look boost 2.6; LOOK/FPS HUD live. Playwright coin tests passed on chromium/firefox/webkit/mobile. No debug instrumentation. Dirty trees, not committed. Edit in `~/Developer/Front End/vibecade`, build → copy hash → update `andrewos/vibe/index.html` script only. Next: `/push` when asked, or deferred mobile look / lock-warning polish.
