import http from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocket as WsClient } from "ws";

vi.mock("../lib/database.js", () => ({
  query: vi.fn(),
}));

vi.mock("./linodeService.js", () => ({
  linodeService: {},
}));

vi.mock("../lib/crypto.js", () => ({
  decryptSecret: vi.fn(),
}));

const { initSSHBridge } = await import("./sshBridge.js");

const servers: http.Server[] = [];

function listen(server: http.Server): Promise<number> {
  servers.push(server);

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address === "object") {
        resolve(address.port);
        return;
      }
      reject(new Error("Server did not bind to a TCP port"));
    });
  });
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
});

describe("initSSHBridge", () => {
  it("upgrades SSH websocket requests before returning app-level unauthorized", async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(404);
      res.end();
    });
    initSSHBridge(server);

    const port = await listen(server);
    const messages: string[] = [];

    const result = await new Promise<{ opened: boolean; code: number }>((resolve, reject) => {
      const ws = new WsClient(
        `ws://127.0.0.1:${port}/api/vps/778ac928-acc1-4178-b1ac-6b541f663567/ssh`,
      );
      let opened = false;
      const timeout = setTimeout(() => {
        ws.terminate();
        reject(new Error("Timed out waiting for websocket close"));
      }, 5000);

      ws.on("open", () => {
        opened = true;
      });
      ws.on("message", (data) => {
        messages.push(data.toString());
      });
      ws.on("close", (code) => {
        clearTimeout(timeout);
        resolve({ opened, code });
      });
      ws.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    expect(result.opened).toBe(true);
    expect(messages.some((message) => message.includes("Unauthorized"))).toBe(true);
  });
});
