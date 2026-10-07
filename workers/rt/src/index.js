/**
 * Cloudflare Worker entry for the Round Table connector API.
 */

import { handleRequest } from './router.js';

export default {
  async fetch(request, env, _ctx) {
    return handleRequest(request, env);
  },
};
