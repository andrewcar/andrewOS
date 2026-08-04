# Plan: ui-test-home

UI tests for the landing page (`index.html`) per master plan.

## Scope

- Load `/` with no unexpected console errors or failed local requests
- Title `andrewOS`; ASCII art `.ascii-art` visible with content
- All `<a>` anchors: local → HTTP 200; external → valid `http(s)` href
- Pixel-sample body background ≈ `#FAF4E8`
- Screenshot desktop + mobile; save under `ai/logs/2/screenshots/` for Read inspection

## Steps

1. Add `tests/ui/home.spec.js` covering the checks above
2. Stub Ko-fi overlay script (third-party) so load stays deterministic
3. Wait for header typewriter to settle before screenshot
4. Run Playwright (desktop + mobile); pixel-sample cream background
5. Read screenshot PNGs; document evidence in implementation log

## Done when

- `npx playwright test tests/ui/home.spec.js` passes both projects
- Screenshots inspected; background samples match `#FAF4E8`
