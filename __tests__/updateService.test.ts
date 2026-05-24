/**
 * updateService tests
 */

import { createSupabaseMock } from './helpers/supabaseMock';

const { builder, setResponse, resetBuilder } = createSupabaseMock();

jest.mock('../lib/supabase', () => ({
  supabase: builder,
  getAdminClient: () => builder,
  setAdminSession: jest.fn(),
  clearAdminSession: jest.fn(),
  default: { supabase: builder },
}));

import { updateService } from '../app/services/updateService';

beforeEach(() => resetBuilder());

// ─── fetchMinimumBuildVersion ─────────────────────────────────────────────────

describe('updateService.fetchMinimumBuildVersion', () => {
  it('returns the parsed integer on success', async () => {
    setResponse({ value: '5' });
    expect(await updateService.fetchMinimumBuildVersion()).toBe(5);
  });

  it('returns null when Supabase returns an error', async () => {
    setResponse(null, { message: 'Row not found' });
    expect(await updateService.fetchMinimumBuildVersion()).toBeNull();
  });

  it('returns null when data is null with no error', async () => {
    setResponse(null);
    expect(await updateService.fetchMinimumBuildVersion()).toBeNull();
  });

  it('returns null for a non-numeric value string', async () => {
    setResponse({ value: 'not-a-number' });
    expect(await updateService.fetchMinimumBuildVersion()).toBeNull();
  });

  it('returns null for an empty string value', async () => {
    setResponse({ value: '' });
    expect(await updateService.fetchMinimumBuildVersion()).toBeNull();
  });

  it('parses "1" as 1', async () => {
    setResponse({ value: '1' });
    expect(await updateService.fetchMinimumBuildVersion()).toBe(1);
  });

  it('parses large build numbers correctly', async () => {
    setResponse({ value: '999' });
    expect(await updateService.fetchMinimumBuildVersion()).toBe(999);
  });

  it('queries from("app_config")', async () => {
    setResponse({ value: '1' });
    await updateService.fetchMinimumBuildVersion();
    expect(builder.from).toHaveBeenCalledWith('app_config');
  });

  it('selects "value"', async () => {
    setResponse({ value: '1' });
    await updateService.fetchMinimumBuildVersion();
    expect(builder.select).toHaveBeenCalledWith('value');
  });

  it('filters by key = "minimum_build_version"', async () => {
    setResponse({ value: '1' });
    await updateService.fetchMinimumBuildVersion();
    expect(builder.eq).toHaveBeenCalledWith('key', 'minimum_build_version');
  });

  it('calls .single()', async () => {
    setResponse({ value: '1' });
    await updateService.fetchMinimumBuildVersion();
    expect(builder.single).toHaveBeenCalled();
  });

  it('returns null (fail-open) when fetch throws unexpectedly', async () => {
    builder.single.mockRejectedValueOnce(new Error('Unexpected crash'));
    expect(await updateService.fetchMinimumBuildVersion()).toBeNull();
  });
});
