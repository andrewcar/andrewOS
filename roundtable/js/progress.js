/** Copy for waits. A silent seat should always produce a line before the next long gap. */

export function initialStatusLine(name, status) {
  return `${name} is ${status}…`;
}

export function heartbeatLine(name, status, elapsedMs) {
  if (elapsedMs < 2500) return null;
  const seconds = Math.max(1, Math.round(elapsedMs / 1000));
  if (elapsedMs >= 12000) return `${name} timed out after ${seconds}s.`;
  return `${name} is still ${status}… (${seconds}s)`;
}

export function blockedLine(name, reason) {
  return `${name} is blocked. ${reason}`;
}
