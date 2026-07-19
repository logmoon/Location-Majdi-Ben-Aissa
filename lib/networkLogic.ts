// Pure, framework-agnostic connectivity helpers — no React or NetInfo
// imports, fully testable. Used by app/context/NetworkContext.tsx.

/**
 * Derives an effective "are we actually online" boolean from a NetInfo
 * state snapshot. `isConnected` only reflects radio-level association
 * (has a WiFi/cellular link); `isInternetReachable` reflects whether that
 * link actually reaches the internet (NetInfo performs a reachability
 * probe for this). We require both, and only treat `isInternetReachable
 * === false` as a hard "no" — while it's `null` (still being determined)
 * we fall back to `isConnected` so we don't flicker offline on every check.
 */
export function deriveConnected(state: { isConnected: boolean | null; isInternetReachable: boolean | null }): boolean {
  if (state.isConnected !== true) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

/**
 * Races a promise against a timeout so a hung underlying call (e.g. a
 * connectivity probe that stalls instead of resolving/rejecting on a bad
 * network) can never block the caller forever. Whichever settles first wins;
 * the timer is always cleared afterwards so a fast-resolving promise doesn't
 * leave a dangling setTimeout running in the background.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}
