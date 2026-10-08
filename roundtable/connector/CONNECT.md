# Connect Round Table to Grok

Grok can use Round Table as a custom connector. Paste this MCP server URL:

```text
https://roundtable.lol/rt/v1/mcp
```

Transport: **Streamable HTTP** (stateless JSON responses, no SSE session).

Alias, same Worker: `https://roundtable.lol/mcp`

`https://rt.andrewos.com/rt/v1/mcp` answers too. Prefer `roundtable.lol`.

## Auth

Round Table uses the connector session the API already mints. No provider key is built into the server.

1. Mint a session. The default life is 1 hour. `ttlSeconds` can be up to 7 days (`604800`) for a connector you leave signed in:

```bash
curl -s -X POST https://roundtable.lol/rt/v1/sessions \
  -H 'content-type: application/json' \
  -d '{"ttlSeconds":604800}'
```

2. In Grok, open [grok.com/connectors](https://grok.com/connectors), choose **New Connector**, then **Custom**, and paste the MCP URL above.
3. When Grok asks for authentication, send the session token as a bearer credential:

```text
Authorization: Bearer <accessToken>
```

From a shell, the same header is:

```bash
grok mcp add --transport http round-table https://roundtable.lol/rt/v1/mcp \
  --header "Authorization: Bearer ${ROUND_TABLE_TOKEN}"
```

The token is a Round Table session. It is not a Grok, Claude, Gemini, Muse, or DeepSeek key. When it expires, mint another and update the header.

If the connector has no header, Grok can call `rt_open_session` and pass `accessToken` on later tools. Prefer the header so the token stays out of the chat.

Provider keys, if you store them, go through `rt_set_secrets` (secure input only). Do not paste them into the conversation.

Without a stored Grok key, `rt_start_quest` returns a local preview split. With a Grok key stored for that session, Grok drafts the split.

Sessions and stored keys live in Worker memory unless `RT_KV` is bound. A restart can drop them. Mint a new session if calls start returning unauthorized.

## Tools

| Tool | Auth | What it does |
|------|------|----------------|
| `rt_health` | no | Liveness |
| `rt_roster` | no | Seats and provider ids. Speak with the `name` field. |
| `rt_open_session` | no | Mint a bearer session |
| `rt_set_secrets` | yes | Store provider keys for the session. Values are not returned. |
| `rt_start_quest` | yes | Preview a quest, or ask Grok to draft it when a Grok key is stored |
| `rt_quest_status` | yes | Read the proposal, messages, and any posted arbiter decision |

Provider ids for keys: `arbiter` (Grok), `openai` (Codex), `anthropic` (Claude), `google` (Gemini), `meta` (Muse), `deepseek` (DeepSeek).

Seat names to use with a person: Grok, Codex, Claude, Gemini, Muse, DeepSeek.

## Arbiter webhook (off by default)

A later step lets Grok sit in the arbiter seat: Round Table POSTs the turn to an HTTPS webhook, and that listener POSTs the decision back. The server routes exist, and they stay **off** unless `RT_ARBITER_WEBHOOK` is `1` or `true`. Until then they return `403` `arbiter_webhook_disabled`, and quests behave as they do today.

When Andrew turns the flag on:

- `PUT /rt/v1/arbiter-webhook` with `{ "url": "https://..." }` stores the URL for the session
- Creating a quest notifies that URL with the goal, seats, and a one-time callback bearer
- `POST /rt/v1/quests/:id/arbiter` accepts `{ "approach", "allocations", "text" }` using the callback bearer or the session bearer

The webhook URL must be public `https`. Localhost, private IPs, and URLs with credentials are rejected. Provider keys are not included in the payload. The existing arbiter picker in the web app is unchanged.

`rt_set_arbiter_webhook` shows up in the MCP tool list only while the flag is on.

## Local

```bash
RT_SESSION_SECRET=local-dev-session-secret-change-me npm run rt:dev
```

MCP: `http://127.0.0.1:8787/rt/v1/mcp`

With the static UI as well: `npx wrangler dev -c workers/rt/wrangler.toml` (copy `workers/rt/.dev.vars.example` to `workers/rt/.dev.vars` first).
