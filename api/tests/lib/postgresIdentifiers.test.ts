import { describe, expect, it } from "vitest";
import {
  buildListenCommand,
  buildUnlistenCommand,
} from "../../lib/postgresIdentifiers.js";

describe("postgresIdentifiers", () => {
  it("builds LISTEN statements with escaped identifiers", () => {
    expect(buildListenCommand("ticket_123e4567-e89b-12d3-a456-426614174000")).toBe(
      'LISTEN "ticket_123e4567-e89b-12d3-a456-426614174000"',
    );
  });

  it("builds UNLISTEN statements with escaped identifiers", () => {
    expect(
      buildUnlistenCommand("ticket_123e4567-e89b-12d3-a456-426614174000"),
    ).toBe('UNLISTEN "ticket_123e4567-e89b-12d3-a456-426614174000"');
  });

  it("rejects invalid channel names before building SQL", () => {
    expect(() => buildListenCommand('ticket_bad"; DROP TABLE users; --')).toThrow(
      "Invalid channel name",
    );
  });

  it("rejects identifiers that exceed PostgreSQL's 63-byte limit", () => {
    const oversizedIdentifier = `ticket_${"a".repeat(57)}`;

    expect(() => buildUnlistenCommand(oversizedIdentifier)).toThrow(
      "Invalid channel name",
    );
  });
});
