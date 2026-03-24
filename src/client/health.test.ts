import { randomUUID } from "node:crypto";
import net from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocketServer } from "ws";
import { generateIdentity } from "../crypto/index.js";
import { GatewayClient } from "./gateway-client.js";

function findFreePort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
  });
}

describe("client/health", () => {
  let client: GatewayClient;
  let wss: WebSocketServer;

  afterEach(async () => {
    if (client) await client.stopAndWait();
    if (wss) await new Promise<void>((resolve) => wss.close(() => resolve()));
  });

  it("reports health metrics after connect", async () => {
    const port = await findFreePort();
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
              payload: { protocol: 3, policy: { tickIntervalMs: 5000 } },
            }),
          );
        }
      });
    });

    const identity = generateIdentity();
    const connected = vi.fn();
    client = new GatewayClient({
      url: `ws://127.0.0.1:${port}`,
      deviceIdentity: identity,
      onHelloOk: connected,
    });

    // Before connect
    const healthBefore = client.getHealth();
    expect(healthBefore.connected).toBe(false);
    expect(healthBefore.connectedAtMs).toBeNull();
    expect(healthBefore.reconnectCount).toBe(0);

    client.start();
    await vi.waitFor(() => expect(connected).toHaveBeenCalled(), { timeout: 2000 });

    // After connect
    const healthAfter = client.getHealth();
    expect(healthAfter.connected).toBe(true);
    expect(healthAfter.connectedAtMs).toBeGreaterThan(0);
    expect(healthAfter.lastTickMs).toBeGreaterThan(0);
    expect(healthAfter.tickIntervalMs).toBe(5000);
    expect(healthAfter.reconnectCount).toBe(0);
  });

  it("increments reconnectCount on reconnect", async () => {
    const port = await findFreePort();
    wss = new WebSocketServer({ port });
    const connections: import("ws").WebSocket[] = [];
    wss.on("connection", (ws) => {
      connections.push(ws);
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
              payload: { protocol: 3, policy: {} },
            }),
          );
        }
      });
    });

    const identity = generateIdentity();
    const connected = vi.fn();
    client = new GatewayClient({
      url: `ws://127.0.0.1:${port}`,
      deviceIdentity: identity,
      onHelloOk: connected,
    });
    client.start();

    await vi.waitFor(() => expect(connected).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(client.getHealth().reconnectCount).toBe(0);

    // Force disconnect
    connections[0].close();
    await vi.waitFor(() => expect(connected).toHaveBeenCalledTimes(2), { timeout: 5000 });
    expect(client.getHealth().reconnectCount).toBe(1);
  });
});
