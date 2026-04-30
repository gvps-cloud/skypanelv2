import { vi } from "vitest";

type QueryResult = {
  rows?: unknown[];
  rowCount?: number;
  fields?: unknown[];
};

let mockQueryInstance: ReturnType<typeof vi.fn> | null = null;

export function setupMockDatabase(overrides?: QueryResult): {
  mockQuery: ReturnType<typeof vi.fn>;
  reset: () => void;
} {
  mockQueryInstance = vi.fn().mockResolvedValue(overrides ?? { rows: [], rowCount: 0 });

  const mockTransaction = vi.fn(async (callback: (client: unknown) => Promise<unknown>) =>
    callback({ query: mockQueryInstance! }),
  );

  vi.mock("../../lib/database.js", () => ({
    query: mockQueryInstance!,
    transaction: mockTransaction,
  }));

  return {
    get mockQuery() {
      return mockQueryInstance!;
    },
    reset() {
      mockQueryInstance?.mockClear();
    },
  };
}

export function mockQueryResult(rows: unknown[], rowCount?: number): QueryResult {
  return {
    rows,
    rowCount: rowCount ?? rows.length,
  };
}

export function mockQueryError(message: string, code?: string): Error {
  const err = new Error(message);
  (err as any).code = code;
  return err;
}

export function getMockQuery(): ReturnType<typeof vi.fn> | null {
  return mockQueryInstance;
}
