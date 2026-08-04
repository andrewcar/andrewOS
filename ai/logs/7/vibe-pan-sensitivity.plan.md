# Plan: vibe-pan-sensitivity

Increase vibecade touch-pan sensitivity by 25% (0.004 → 0.005) and redeploy the built bundle into andrewos.

## Steps

1. In `~/Developer/Front End/vibecade/src/main.js`, set touch look multiplier to `0.005` (named constant + debug hook for tests)
2. `npm run build` in vibecade
3. Copy new `dist/assets/index.[hash].js` into `andrewos/vibe/assets/`; update `vibe/index.html` script `src` hash only
4. Remove superseded andrewos hashed JS bundles (keep only the new active one + any still-referenced assets)
5. Playwright: assert sensitivity hook `0.005`; synthetic right-half touch-drag rotates camera
6. Log + mark todo completed

## Done when

- Deployed bundle uses 0.005
- `npx playwright test` for the pan check passes on mobile (touch)
