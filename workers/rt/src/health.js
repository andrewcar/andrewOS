/**
 * Shared liveness payload for GET /rt/v1/health and the MCP rt_health tool.
 */

export function connectorHealth() {
  return {
    ok: true,
    service: 'round-table-connector',
    version: 1,
    honesty:
      'API seats use caller-provided provider keys (Grok, Codex, Claude, Gemini, Muse, DeepSeek). Storing or proxying keys does not make them fleet seats.',
  };
}
