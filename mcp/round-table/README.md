# Round Table MCP (slice 1)

Tool descriptor for the Round Table connector HTTP API.

**Connect URL:** `https://roundtable.lol/rt/v1/mcp` (Streamable HTTP). Steps: [`../../roundtable/connector/CONNECT.md`](../../roundtable/connector/CONNECT.md).

Canonical docs: [`../../roundtable/connector/README.md`](../../roundtable/connector/README.md)

Descriptor: [`tools.json`](./tools.json) (same schema as `roundtable/connector/mcp-tools.json`).

**BASE_URL:** `baseUrlDefault` is `https://roundtable.lol` (paths `/rt/v1/...`). Override with `ROUND_TABLE_API_BASE`. The same Worker serves the UI at `/` via Static Assets. Until BotBot deploys after merge, workers.dev remains a temporary fallback — see the connector README.

**Honesty:** API seats (Grok, Codex, Claude, Gemini, Muse, DeepSeek) use caller-provided keys. They are not a hosted fleet.
