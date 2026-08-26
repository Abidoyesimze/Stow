/**
 * Optional, cookieless page-view ping.
 *
 * Disabled by default. Enable by setting NEXT_PUBLIC_ENABLE_PAGE_VIEW_PING to
 * "true" or "1" at build time. When disabled (or unset), trackPageView is a
 * no-op and no network request is made.
 *
 * The ping never sets or reads cookies, never touches localStorage, and its
 * payload carries no PII — only the current path and a timestamp.
 */

const ENABLE_FLAG = "NEXT_PUBLIC_ENABLE_PAGE_VIEW_PING";
const ENDPOINT_VAR = "NEXT_PUBLIC_PAGE_VIEW_PING_ENDPOINT";
const DEFAULT_ENDPOINT = "/api/analytics/pageview";

export function isPageViewPingEnabled(): boolean {
  const value = process.env[ENABLE_FLAG]?.trim().toLowerCase();
  return value === "true" || value === "1";
}

export function getPageViewPingEndpoint(): string {
  return process.env[ENDPOINT_VAR] || DEFAULT_ENDPOINT;
}

export function trackPageView(path?: string): void {
  if (!isPageViewPingEnabled()) return;
  if (typeof window === "undefined") return;

  const resolvedPath = path ?? window.location.pathname;
  const endpoint = getPageViewPingEndpoint();
  const payload = JSON.stringify({
    path: resolvedPath,
    timestamp: Date.now(),
  });

  if (typeof navigator.sendBeacon === "function") {
    navigator.sendBeacon(endpoint, new Blob([payload], { type: "application/json" }));
    return;
  }

  fetch(endpoint, {
    method: "POST",
    body: payload,
    headers: { "Content-Type": "application/json" },
    credentials: "omit",
    keepalive: true,
  }).catch(() => {
    // Best-effort; a failed ping must never surface to the user.
  });
}
