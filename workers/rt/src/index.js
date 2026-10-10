/**
 * Cloudflare Worker entry: Round Table connector API (/rt/* and /mcp) + static UI assets.
 */

import { handleRequest } from './router.js';
import { wwwToApexRedirect } from './www-redirect.js';

function isApiPath(pathname) {
  // /rt/v1/bug/* is included so the bug-report proxy runs before static assets.
  return pathname === '/rt' || pathname.startsWith('/rt/') || pathname === '/mcp';
}

export default {
  async fetch(request, env, _ctx) {
    const wwwRedirect = wwwToApexRedirect(request);
    if (wwwRedirect) return wwwRedirect;

    const url = new URL(request.url);
    if (isApiPath(url.pathname)) {
      return handleRequest(request, env);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    // Local Node server (npm run rt:dev) has no assets binding.
    return handleRequest(request, env);
  },
};
