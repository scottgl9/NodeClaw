import { randomUUID } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebSocketServer, WebSocket as WsWebSocket } from "ws";
import { pairWithGateway } from "./pair.js";
import { loadDeviceAuthToken } from "../crypto/index.js";

function findFreePort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
  });
}

describe("pairing/pair", () => {
  let tmpDir: string;
  let env: NodeJS.ProcessEnv;
  let wss: WebSocketServer;
  let port: number;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nodeclaw-pair-"));
    env = { NODECLAW_HOME: tmpDir };
    port = await findFreePort();
  });

  afterEach(async () => {
    if (wss) {
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("pairs successfully when gateway issues deviceToken", async () => {
    const deviceToken = `tok_${randomUUID()}`;

    wss = new WebSocketServer({ port });
    wss.on("connection", (ws) => {
      ws.send(
        JSON.stringify({
          type: "event",
          event: "connect.challenge",
          payload: { nonce: randomUUID() },
        }),
      );

      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "req" && msg.method === "connect") {
          ws.send(
            JSON.stringify({
              type: "res",
              id: msg.id,
              ok: true,
              payload: {
                protocol: 3,
                policy: { tickIntervalMs: 30000 },
                auth: {
                  deviceToken,
                  role: "node",
                  scopes: ["node.invoke"],
                },
              },
            }),
          );
        }
      });
    });

    const result = await pairWithGateway({
      gatewayUrl: `ws://127.0.0.1:${port}`,
      deviceName: "test-node",
      env,
    });

    expect(result.paired).toBe(true);
    expect(result.deviceId).toMatch(/^[0-9a-f]{64}$/);

    // Verify token was stored
    const tokenStorePath = path.join(tmpDir, "identity", "device-auth.json");
    const stored = loadDeviceAuthToken(tokenStorePath, result.deviceId, "node");
    expect(stored).not.toBeNull();
    expect(stored!.token).toBe(deviceToken);
  });

  it("reports already paired if token exists", async () => {
    // Pre-create identity and token
    const { pairWithGateway: pair2 } = await import("./pair.js");

    // First, pair to create the identity and token
    const deviceToken = `tok_${randomUUID()}`;
    wss = new WebSocketServer({ port });
    wss.on("connection", (ws) => {
      ws.send(
        JSON.stringify({
          type: "event",
          event: "connect.challenge",
          payload: { nonce: randomUUID() },
        }),
      );
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "req" && msg.method === "connect") {
          ws.send(
            JSON.stringify({
              type: "res",
              id: msg.id,
              ok: true,
              payload: {
                protocol: 3,
                policy: {},
                auth: { deviceToken, role: "node", scopes: [] },
              },
            }),
          );
        }
      });
    });

    await pairWithGateway({
      gatewayUrl: `ws://127.0.0.1:${port}`,
      env,
    });

    // Second pair should detect existing token
    const result = await pair2({
      gatewayUrl: `ws://127.0.0.1:${port}`,
      env,
    });
    expect(result.paired).toBe(true);
    expect(result.message).toContain("Already paired");
  });
});
