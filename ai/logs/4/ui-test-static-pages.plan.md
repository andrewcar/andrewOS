# Plan: ui-test-static-pages

UI tests for boredgames, ruleofthree, and docs assets.

## Scope

- Support pages: `/boredgames/support.html`, `/ruleofthree/support.html` — 200, title, greeting heading text, `support.css` loads
- Privacy pages: `/boredgames/privacypolicy.html`, `/ruleofthree/privacypolicy.html` — 200, “PRIVACY NOTICE” visible
- Docs: `/docs/cv.pdf` (200, PDF content-type), `/docs/privacyPolicy.txt` (200, text, contains “Privacy Policy”)
- Screenshot support pages → `ai/logs/4/screenshots/`

## Done when

`npx playwright test tests/ui/static-pages.spec.js` passes both projects.
