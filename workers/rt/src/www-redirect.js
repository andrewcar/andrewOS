/**
 * Apex canonical host for Round Table public site + API.
 */

export const APEX_HOST = 'roundtable.lol';
export const WWW_HOST = 'www.roundtable.lol';

/**
 * If the request is on www.roundtable.lol, return a 301 Response to the apex
 * (same path + query). Otherwise null.
 * @param {Request} request
 * @returns {Response | null}
 */
export function wwwToApexRedirect(request) {
  const url = new URL(request.url);
  if (url.hostname !== WWW_HOST) return null;
  url.hostname = APEX_HOST;
  return Response.redirect(url.toString(), 301);
}
