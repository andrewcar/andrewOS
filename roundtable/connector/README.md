# Round Table connector (slice 1)

HTTP API plus a Streamable HTTP MCP server so Grok can run a Round Table quest from a connector — not merely open [the public webpage](https://roundtable.lol).

**Connect URL (after deploy):** `https://roundtable.lol/rt/v1/mcp`

Short connect steps, tools, and auth: [`CONNECT.md`](./CONNECT.md).

**Hosting:** Worker `round-table-connector` serves **both** the static UI (Workers Static Assets from `roundtable/` at the domain root) and the API under `/rt/v1/*`. Canonical public home is **`https://roundtable.lol`**. Custom domains in `workers/rt/wrangler.toml`: `roundtable.lol`, `www.roundtable.lol` (301 → apex in Worker), and `rt.andrewos.com` (kept as an alias). No Cloudflare Pages project.

During transition, the same UI still loads at `https://andrewos.com/roundtable` (GitHub Pages). Because andrewos.com is DNS-only GH Pages, cutover uses an **early client-side redirect** in `roundtable/index.html` (andrewos.com hosts only) — not a Cloudflare 301.

## Honesty (read this)

Storing or proxying a caller’s provider API keys does not turn those seats into a private assistant or a hosted fleet.

Connector seats are **API product seats** only:

| Seat id   | Display name | Provider id |
|-----------|--------------|-------------|
| `botbot`  | Grok (API)   | `arbiter` (xAI Chat Completions) |
| `codex`   | Codex        | `openai` |
| `claude`  | Claude       | `anthropic` |
| `gemini`  | Gemini       | `google` |
| `muse`    | Muse         | `meta` |
| `deepseek`| DeepSeek     | `deepseek` |

Public product names only: Grok, Codex, Claude, Gemini, Muse, DeepSeek.

## What works in slice 1

| Endpoint | Behavior |
|----------|----------|
| `GET /rt/v1/health` | Liveness + honesty blurb |
| `GET /rt/v1/roster` | Seat ids + product names + providerIds (no secrets) |
| `POST /rt/v1/sessions` | Mint short-lived Bearer session (HMAC) |
| `PUT /rt/v1/secrets` | Store provider key map for the session (AES-GCM at rest) |
| `POST /rt/v1/quests` | Create quest; **preview** arbiter split locally, or live xAI when `arbiter` key present |
| `GET /rt/v1/quests/:id` | Status + proposal + messages |
| `POST /rt/v1/proxy/chat` | Real proxy for **xAI (`arbiter`)** and **OpenAI-compatible** (`openai`, `deepseek`); Anthropic/Google/Muse → **501** |

## Env vars

| Var | Required | Purpose |
|-----|----------|---------|
| `RT_SESSION_SECRET` | **Yes** (min 16 chars) | HMAC session tokens + AES-GCM encryption of stored keys |
| `RT_KV` (Workers binding) | Optional | Durable KV for secrets/quests; memory used if unset |
| `PORT` / `HOST` | Optional | Node local server (default `127.0.0.1:8787`) |

## Local run

From the repo root:

```bash
# Node (no Cloudflare account needed)
RT_SESSION_SECRET=local-dev-session-secret-change-me npm run rt:dev

# Or Wrangler (API + static UI assets)
cp workers/rt/.dev.vars.example workers/rt/.dev.vars
npx wrangler dev -c workers/rt/wrangler.toml
# → UI at http://127.0.0.1:8787/  ·  API at http://127.0.0.1:8787/rt/v1/health
```

Smoke:

```bash
curl -s http://127.0.0.1:8787/rt/v1/health
curl -s http://127.0.0.1:8787/rt/v1/roster
curl -s -X POST http://127.0.0.1:8787/rt/v1/sessions
# With wrangler dev, also: curl -sI http://127.0.0.1:8787/  (HTML UI)
```

## Production BASE_URL

Canonical production base (MCP / clients default in `mcp-tools.json` / `tools.json`):

```text
https://roundtable.lol
```

Example: `GET https://roundtable.lol/rt/v1/...` (e.g. `GET https://roundtable.lol/rt/v1/health`)

UI: `https://roundtable.lol/` (same Worker; static assets). `www.roundtable.lol` 301s to the apex.

**Cutover / deploy:** Andrew approved full cutover. This change stays **Merge/Hold** — deploy with `wrangler deploy -c workers/rt/wrangler.toml` after Andrew says merge. Custom domains are declared in `wrangler.toml` (no separate Pages or route steps beyond that). Until deploy, `workers.dev` remains a temporary fallback:

```text
https://round-table-connector.andrew-carvajal.workers.dev
```

Example fallback: `GET https://round-table-connector.andrew-carvajal.workers.dev/rt/v1/health`

Override with `ROUND_TABLE_API_BASE` when needed (e.g. point at workers.dev until cutover). Local `npm run rt:dev` still uses `http://127.0.0.1:8787` (API only; no static assets).

## MCP install

Live endpoint (Streamable HTTP): `https://roundtable.lol/rt/v1/mcp` (alias `/mcp`). See [`CONNECT.md`](./CONNECT.md) for the URL to paste, bearer auth, and the tool list.

[`mcp-tools.json`](./mcp-tools.json) (mirrored under [`../../mcp/round-table/`](../../mcp/round-table/)) still describes the underlying HTTP operations. The Worker is what Grok should connect to.

Flow:
   1. `rt_health` — confirm the API is up
   2. `rt_roster` — list seats
   3. Session is minted by the host (or call `POST /rt/v1/sessions`); keep the Bearer token
   4. `rt_set_secrets` — pass provider keys via **secure input** (never echo values into chat)
   5. `rt_start_quest` — `{ goal, enabledSeatIds? }`
   6. `rt_quest_status` — poll proposal + messages

See `mcp-tools.json` for tool schemas. Secret tools must use secure/hidden input channels; tool descriptions must not request that keys be pasted into open chat.

## Tests

```bash
npm test -- tests/unit/rt-connector.test.js
```

## Follow-up slices (not this PR)

2. Hardened secrets (rotation, TTL UI, redact audits)
3. Richer roster / capability flags
4. Full quest lifecycle (votes, relays, revision)
5. Anthropic + Google live proxy; Muse relay when available
6. Auto-install into Andrew’s fleet (out of scope forever for the public product path)
