# Round Table connector (slice 1)

HTTP API + MCP tool descriptors so a **primary Grok Bot** (assistant with tools/memory) can run a Round Table quest — not merely open [the public webpage](https://andrewos.com/roundtable).

The public UI under `roundtable/` stays as-is. This connector is a parallel backend path.

## Honesty (read this)

Storing or proxying a user’s **device / xAI / OpenAI API keys does not make those seats BotBot or private fleet bots**.

Connector seats are **API product seats** only:

| Seat id   | Display name | Provider id |
|-----------|--------------|-------------|
| `botbot`  | Grok (API)   | `arbiter` (xAI Chat Completions) |
| `codex`   | Codex        | `openai` |
| `claude`  | Claude       | `anthropic` |
| `gemini`  | Gemini       | `google` |
| `muse`    | Muse         | `meta` |
| `deepseek`| DeepSeek     | `deepseek` |

Never treat connector docs or tool descriptions as fleet identity. Public product names only — not `___Bot` / BotBot branding for the caller.

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

# Or Wrangler
cp workers/rt/.dev.vars.example workers/rt/.dev.vars
npx wrangler dev -c workers/rt/wrangler.toml
```

Smoke:

```bash
curl -s http://127.0.0.1:8787/rt/v1/health
curl -s http://127.0.0.1:8787/rt/v1/roster
curl -s -X POST http://127.0.0.1:8787/rt/v1/sessions
```

## Production BASE_URL

Live connector (MCP / clients default):

```text
https://round-table-connector.andrew-carvajal.workers.dev
```

Example: `GET https://round-table-connector.andrew-carvajal.workers.dev/rt/v1/health`

`andrewos.com/rt` is **not** wired yet — apex `andrewos.com` is GitHub Pages. A custom path or host (e.g. Cloudflare zone + `rt.andrewos.com` CNAME) is a separate follow-up; this Worker stays on `workers.dev` only.

Override with `ROUND_TABLE_API_BASE` when needed. Local `npm run rt:dev` (below) still uses `http://127.0.0.1:8787`.

## Grok Bot / MCP install

1. Point clients at the production `BASE_URL` above (or local `http://127.0.0.1:8787` while developing). Defaults live in [`mcp-tools.json`](./mcp-tools.json) / [`../../mcp/round-table/tools.json`](../../mcp/round-table/tools.json).
2. Point the MCP client at [`mcp-tools.json`](./mcp-tools.json) (also mirrored under [`../../mcp/round-table/`](../../mcp/round-table/)).
3. Flow a primary Grok Bot should use:
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
