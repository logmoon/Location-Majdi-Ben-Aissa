/**
 * Shared Supabase builder mock helpers.
 *
 * USAGE IN EACH TEST FILE:
 *
 *   // 1. Define the builder and mock BEFORE imports (Jest hoisting requirement)
 *   const { builder, setResponse, resetBuilder } = createSupabaseMock();
 *   jest.mock('../../lib/supabase', () => ({
 *     supabase: builder,
 *     setAdminSession: jest.fn(),
 *     clearAdminSession: jest.fn(),
 *     default: { supabase: builder },
 *   }));
 *
 *   // 2. Reset between tests
 *   beforeEach(() => resetBuilder());
 *
 *   // 3. Configure per-test response
 *   setResponse({ data: [...], error: null });
 *
 * WHY NOT A SINGLE SHARED INSTANCE:
 *   jest.mock() factories are hoisted before imports and must close over
 *   variables defined in the same file. A shared singleton imported from
 *   another module would be undefined at hoist time. This factory function
 *   is the correct pattern — call it once at the top of each test file,
 *   before the jest.mock() call, and pass the returned builder into the factory.
 */

type MockResponse = { data: any; error: any };

const CHAINABLE_METHODS = [
  'from', 'select', 'insert', 'update', 'delete', 'upsert',
  'eq', 'neq', 'gte', 'lte', 'lt', 'gt', 'order', 'limit',
] as const;

type ChainableMethod = typeof CHAINABLE_METHODS[number];

export interface SupabaseMock {
  builder: Record<ChainableMethod | 'single' | 'then', jest.Mock>;
  setResponse: (data: any, error?: any) => void;
  resetBuilder: () => void;
}

/**
 * Creates a fresh Supabase builder mock.
 * Call this once at the top of each test file, before jest.mock().
 */
export function createSupabaseMock(): SupabaseMock {
  let mockResponse: MockResponse = { data: null, error: null };

  const builder = {
    ...Object.fromEntries(
      CHAINABLE_METHODS.map(m => [m, jest.fn().mockReturnThis()])
    ),
    single: jest.fn().mockImplementation(() => Promise.resolve(mockResponse)),
    then: jest.fn().mockImplementation((resolve: (v: any) => any) =>
      Promise.resolve(mockResponse).then(resolve)
    ),
  } as Record<ChainableMethod | 'single' | 'then', jest.Mock>;

  function setResponse(data: any, error: any = null) {
    mockResponse = { data, error };
    builder.single.mockImplementation(() => Promise.resolve(mockResponse));
    builder.then.mockImplementation((resolve: (v: any) => any) =>
      Promise.resolve(mockResponse).then(resolve)
    );
  }

  function resetBuilder() {
    mockResponse = { data: null, error: null };
    for (const m of CHAINABLE_METHODS) {
      builder[m].mockClear();
      builder[m].mockReturnThis();
    }
    builder.single.mockClear();
    builder.single.mockImplementation(() => Promise.resolve(mockResponse));
    builder.then.mockClear();
    builder.then.mockImplementation((resolve: (v: any) => any) =>
      Promise.resolve(mockResponse).then(resolve)
    );
  }

  return { builder, setResponse, resetBuilder };
}
