import { deriveConnected, withTimeout } from '../lib/networkLogic';

describe('deriveConnected', () => {
  it('is true when connected and reachable', () => {
    expect(deriveConnected({ isConnected: true, isInternetReachable: true })).toBe(true);
  });

  it('is true when connected and reachability is still unknown (null)', () => {
    // We don't want to flicker offline while NetInfo is still determining
    // reachability — fall back to isConnected.
    expect(deriveConnected({ isConnected: true, isInternetReachable: null })).toBe(true);
  });

  it('is false when reachability is explicitly false, even if radio-connected', () => {
    // This is the "on WiFi but router has no internet route" case.
    expect(deriveConnected({ isConnected: true, isInternetReachable: false })).toBe(false);
  });

  it('is false when there is no radio-level connection at all', () => {
    expect(deriveConnected({ isConnected: false, isInternetReachable: null })).toBe(false);
  });

  it('is false when isConnected itself is null (unknown)', () => {
    expect(deriveConnected({ isConnected: null, isInternetReachable: null })).toBe(false);
  });
});

describe('withTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves with the inner value when the promise settles before the timeout', async () => {
    const fast = Promise.resolve('ok');
    const result = withTimeout(fast, 10000, 'test');
    await jest.advanceTimersByTimeAsync(0);
    await expect(result).resolves.toBe('ok');
  });

  it('rejects once the timeout elapses if the wrapped promise never settles', async () => {
    // This is the exact real-world failure mode this fix targets: a native
    // call (NetInfo.fetch(), in production) that hangs forever instead of
    // resolving or rejecting. Before the fix, nothing bounded this — the
    // caller's `await` would simply never return, permanently starving
    // every dependent flag (checkInFlightRef, isCheckingConnection).
    const neverSettles = new Promise<string>(() => {
      /* intentionally never resolves or rejects */
    });

    const result = withTimeout(neverSettles, 10000, 'NetInfo.fetch()');
    // Attach the rejection handler before advancing timers so Jest doesn't
    // flag an unhandled rejection when the timeout fires.
    const assertion = expect(result).rejects.toThrow('NetInfo.fetch() timed out after 10000ms');

    await jest.advanceTimersByTimeAsync(10000);
    await assertion;
  });

  it('does not reject early — the timeout only fires after the full duration', async () => {
    const neverSettles = new Promise<string>(() => {});
    const result = withTimeout(neverSettles, 10000, 'test');
    result.catch(() => {}); // prevent unhandled rejection noise from the eventual timeout

    let settled = false;
    result.then(
      () => { settled = true; },
      () => { settled = true; }
    );

    await jest.advanceTimersByTimeAsync(9999);
    expect(settled).toBe(false);

    await jest.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
  });

  it('clears the timer once the wrapped promise resolves, leaving no dangling timeout', async () => {
    const fast = Promise.resolve('ok');
    await withTimeout(fast, 10000, 'test');
    // If the timeout weren't cleared, a pending timer would still be
    // scheduled here even though the race already settled.
    expect(jest.getTimerCount()).toBe(0);
  });

  it('clears the timer once the wrapped promise rejects on its own (not via timeout)', async () => {
    const failing = Promise.reject(new Error('boom'));
    await expect(withTimeout(failing, 10000, 'test')).rejects.toThrow('boom');
    expect(jest.getTimerCount()).toBe(0);
  });
});
