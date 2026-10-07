/**
 * Canonical public home helpers for Round Table.
 * Early redirect in index.html mirrors buildApexRedirectUrl for andrewos.com hosts.
 */

export const CANONICAL_ORIGIN = 'https://roundtable.lol';

/** @param {string} hostname */
export function shouldRedirectAndrewOsHost(hostname) {
  return hostname === 'andrewos.com' || hostname === 'www.andrewos.com';
}

/**
 * Build apex URL for a request that was served under /roundtable on andrewOS.
 * @param {{ hostname: string, pathname: string, search?: string, hash?: string }} loc
 * @returns {string | null} redirect target, or null if no redirect
 */
export function buildApexRedirectUrl(loc) {
  if (!shouldRedirectAndrewOsHost(loc.hostname)) return null;
  const path = loc.pathname || '/';
  const match = path.match(/^\/roundtable(\/.*)?$/i);
  const rest = match ? match[1] || '/' : '/';
  return `${CANONICAL_ORIGIN}${rest}${loc.search || ''}${loc.hash || ''}`;
}
