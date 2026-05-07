import { describe, expect, it } from "vitest";

import { buildSshWebSocketUrl } from "./sshTerminalUrl";

describe("buildSshWebSocketUrl", () => {
  it("uses the current browser origin before runtime CLIENT_URL", () => {
    expect(
      buildSshWebSocketUrl("778ac928-acc1-4178-b1ac-6b541f663567", 27, 156, {
        runtimeConfig: {
          CLIENT_URL: "https://configured.example.test",
        },
        locationOrigin: "https://panel.example.test",
        locationProtocol: "https:",
      }),
    ).toBe(
      "wss://panel.example.test/api/vps/778ac928-acc1-4178-b1ac-6b541f663567/ssh?rows=27&cols=156",
    );
  });

  it("falls back to the current browser origin when runtime config is missing", () => {
    expect(
      buildSshWebSocketUrl("instance id", 30, 120, {
        locationOrigin: "http://localhost:5173",
        locationProtocol: "http:",
      }),
    ).toBe("ws://localhost:5173/api/vps/instance%20id/ssh?rows=30&cols=120");
  });

  it("uses runtime config only when browser origin is unavailable", () => {
    expect(
      buildSshWebSocketUrl("abc", 1, 2, {
        runtimeConfig: {
          CLIENT_URL: "https://configured.example.test",
        },
        locationOrigin: "",
      }),
    ).toBe("wss://configured.example.test/api/vps/abc/ssh?rows=1&cols=2");
  });

  it("uses wss when the current page is https", () => {
    expect(
      buildSshWebSocketUrl("abc", 1, 2, {
        runtimeConfig: {
          CLIENT_URL: "http://internal.example.test",
        },
        locationOrigin: "https://panel.example.test",
        locationProtocol: "https:",
      }),
    ).toBe("wss://panel.example.test/api/vps/abc/ssh?rows=1&cols=2");
  });
});
