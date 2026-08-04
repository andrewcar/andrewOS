# Session handoff: Vibecade play UX + FPS (2026-08-03)

> **Superseded for pickup** by `ai/web/logs/2026-08-03-vibecade-coin-hud-handoff.md` (via portal-font handoff). Continues after master-plan todo `vibe-pan-sensitivity` (`ai/logs/7/`). Play UX content below still accurate as baseline; current bundle/hash is in the newest handoff. Not committed — dirty `main` on andrewos (plus vibecade source changes outside this repo).

---

## Status at a glance

| Area | Status |
|------|--------|
| Play mode (CLICK TO START / ESC / pointer lock) | **Done** — Safari verified; lock fails with `WrongDocumentError` in some Chromium embeds (IDE preview / DevTools) |
| Desktop look sensitivity | **Done** — `DESKTOP_LOOK_SENSITIVITY = 0.005` (`controls.pointerSpeed = 2.5`) |
| Camera-relative WASD without lock | **Done** |
| FPS + coin HUD | **Done** — shared top-right row; FPS gap 10px |
| Perf (shadows / pixel ratio / socket reconnect) | **Done** |
| Debug instrumentation | **Removed** — rebuilt clean bundle `index.abbbd450.js` |
| Tests | **Manual Safari OK** (user). Hearth `/test` skill N/A (iOS). Playwright suite **not re-run** this session after final UI polish |
| Git commit / PR | **Not done** |

---

## What shipped

### 1. Play / look controls

- **CLICK TO START** overlay (Press Start 2P), hidden until font ready (`display=block` + `document.fonts.load`)
- Click/`pointerdown` enters play; **ESC** releases and shows overlay again
- Prefer canvas `requestPointerLock()` first in the gesture; soft-lock fallback (`html.playing` + transparent cursor) when lock fails
- Yellow `#lock-warning` if pointer lock is blocked
- Source: `~/Developer/Front End/vibecade/src/main.js` + `vibecade/index.html`
- Deployed: `andrewos/vibe/index.html` + `vibe/assets/index.abbbd450.js`

### 2. Look feel

- Soft-lock and PointerLockControls aligned at **0.005** effective sensitivity
- Touch look remains `TOUCH_LOOK_SENSITIVITY = 0.005` (+25% from earlier plan todo)

### 3. HUD

- `wallet.js`: `#top-right-hud` with FPS (left) + coins (right), Press Start 2P / 24px / `#C0C0C0`
- FPS number↔label gap **10px**; coin number↔icon gap **5px**; groups separated by **18px**

### 4. Perf

- `renderer.shadowMap.enabled = false`; pixel ratio capped at **1.25**; animate `deltaTime` clamped to **0.05**
- Point/spot/directional `castShadow = false` in `lighting.js`
- Local socket.io: `http://` + limited `reconnectionAttempts` (`multiplayer.js`)

---

## Files touched this session

| Path | What |
|------|------|
| `vibecade/src/main.js` | Play mode, look sensitivity, FPS animate hook, perf clamps (instrumentation removed) |
| `vibecade/src/wallet.js` | Shared FPS+coins HUD |
| `vibecade/src/lighting.js` | Disable cast shadows |
| `vibecade/src/multiplayer.js` | Local reconnect limits |
| `vibecade/index.html` | CLICK TO START / lock-warning / playing cursor CSS |
| `andrewos/vibe/index.html` | Same HTML/CSS + script hash `index.abbbd450.js` |
| `andrewos/vibe/assets/index.abbbd450.js` | Current production build output |

---

## Open / next

1. **`/push`** when ready — commit andrewos (and separately vibecade if that repo should track source). Avoid committing `node_modules` noise / `.cursor/debug-*.log`.
2. Optional: re-run `npm run test:all` on andrewos after vibe bundle change.
3. Pointer lock: document for deploy that real Chrome/Safari tabs work; IDE Simple Browser often hits `WrongDocumentError`.
4. Consider hiding/removing `#lock-warning` copy for production if too loud, or only show after N failures.

---

## Prompt for next chat

> Read `ai/web/logs/2026-08-03-vibecade-play-ux-handoff.md`. Vibecade play UX (CLICK TO START / ESC / pointer lock / look sensitivity 0.005 / FPS+coin HUD / perf) is deployed as `vibe/assets/index.abbbd450.js` with instrumentation removed. Source of truth for edits: `~/Developer/Front End/vibecade` then Vite build → copy hashed JS + update `andrewos/vibe/index.html` script tag only. Not committed. Next: push when asked, or polish remaining vibe issues.
