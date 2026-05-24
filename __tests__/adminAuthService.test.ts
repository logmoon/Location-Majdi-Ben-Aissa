/**
 * adminAuthService tests
 *
 * Mocks:
 *   - global fetch  → controls Edge Function responses
 *   - supabase.ts   → verifies setAdminSession / clearAdminSession are called
 */

// ─── Mock supabase session helpers ───────────────────────────────────────────

const mockSetAdminSession = jest.fn().mockResolvedValue(undefined);
const mockClearAdminSession = jest.fn().mockResolvedValue(undefined);

jest.mock('../lib/supabase', () => ({
  supabase: {},
  setAdminSession: mockSetAdminSession,
  clearAdminSession: mockClearAdminSession,
  default: {},
}));

// ─── Mock global fetch ────────────────────────────────────────────────────────

const mockFetch = jest.fn();
global.fetch = mockFetch;

// ─── Import after mocks ───────────────────────────────────────────────────────

import { adminAuthService } from '../app/services/adminAuthService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockFetchResponse(status: number, body: object) {
  mockFetch.mockResolvedValueOnce({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

beforeEach(() => {
  mockFetch.mockClear();
  mockSetAdminSession.mockClear();
  mockClearAdminSession.mockClear();
});

// ─── login ────────────────────────────────────────────────────────────────────

describe('adminAuthService.login', () => {
  it('returns success and calls setAdminSession on 200 with token', async () => {
    mockFetchResponse(200, { token: 'jwt-abc123' });

    const result = await adminAuthService.login('correct-password');

    expect(result).toEqual({ success: true });
    expect(mockSetAdminSession).toHaveBeenCalledWith('jwt-abc123');
    expect(mockSetAdminSession).toHaveBeenCalledTimes(1);
  });

  it('returns invalid_password on 401', async () => {
    mockFetchResponse(401, { error: 'Invalid password' });

    const result = await adminAuthService.login('wrong-password');

    expect(result).toEqual({ success: false, error: 'invalid_password' });
    expect(mockSetAdminSession).not.toHaveBeenCalled();
  });

  it('returns server_error on 500', async () => {
    mockFetchResponse(500, { error: 'Internal server error' });

    const result = await adminAuthService.login('any-password');

    expect(result).toEqual({ success: false, error: 'server_error' });
    expect(mockSetAdminSession).not.toHaveBeenCalled();
  });

  it('returns server_error on 200 with no token in body', async () => {
    mockFetchResponse(200, { message: 'ok but no token' });

    const result = await adminAuthService.login('any-password');

    expect(result).toEqual({ success: false, error: 'server_error' });
    expect(mockSetAdminSession).not.toHaveBeenCalled();
  });

  it('returns network_error when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network request failed'));

    const result = await adminAuthService.login('any-password');

    expect(result).toEqual({ success: false, error: 'network_error' });
    expect(mockSetAdminSession).not.toHaveBeenCalled();
  });

  it('POSTs to the correct Edge Function URL', async () => {
    mockFetchResponse(200, { token: 'jwt-abc' });

    await adminAuthService.login('pass');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/admin-login'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('sends the password in the request body', async () => {
    mockFetchResponse(200, { token: 'jwt-abc' });

    await adminAuthService.login('my-secret');

    const callArgs = mockFetch.mock.calls[0][1];
    const body = JSON.parse(callArgs.body);
    expect(body.password).toBe('my-secret');
  });

  it('includes Authorization and apikey headers', async () => {
    mockFetchResponse(200, { token: 'jwt-abc' });

    await adminAuthService.login('pass');

    const headers = mockFetch.mock.calls[0][1].headers;
    // Authorization header must be present and start with "Bearer "
    expect(headers['Authorization']).toMatch(/^Bearer /);
    // apikey header must be present (may be empty string in test env where env vars aren't set)
    expect(headers).toHaveProperty('apikey');
  });

  it('does not call setAdminSession on 401', async () => {
    mockFetchResponse(401, { error: 'Invalid password' });

    await adminAuthService.login('wrong');

    expect(mockSetAdminSession).not.toHaveBeenCalled();
  });

  it('does not call setAdminSession on network error', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

    await adminAuthService.login('pass');

    expect(mockSetAdminSession).not.toHaveBeenCalled();
  });
});

// ─── logout ───────────────────────────────────────────────────────────────────

describe('adminAuthService.logout', () => {
  it('calls clearAdminSession', async () => {
    await adminAuthService.logout();

    expect(mockClearAdminSession).toHaveBeenCalledTimes(1);
  });

  it('resolves without throwing', async () => {
    await expect(adminAuthService.logout()).resolves.toBeUndefined();
  });

  it('calls clearAdminSession even if called multiple times', async () => {
    await adminAuthService.logout();
    await adminAuthService.logout();

    expect(mockClearAdminSession).toHaveBeenCalledTimes(2);
  });
});
