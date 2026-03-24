import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocketServer, WebSocket as WsWebSocket } from "ws";
import { generateIdentity } from "../crypto/index.js";
import { GatewayClient } from "./gateway-client.js";

function findFreePort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = require("node:net").createServer();
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

type MockServer = {
  wss: WebSocketServer;
  port: number;
  url: string;
  clients: WsWebSocket[];
  close: () => Promise<void>;
};

async function createMockGateway(opts?: {
  onConnection?: (ws: WsWebSocket) => void;
}): Promise<MockServer> {
  const port = await findFreePort();
  const wss = new WebSocketServer({ port });
  const clients: WsWebSocket[] = [];

  wss.on("connection", (ws) => {
    clients.push(ws);
    // Send challenge nonce
    ws.send(
      JSON.stringify({
        type: "event",
        event: "connect.challenge",
        payload: { nonce: randomUUID() },
      }),
    );

    if (opts?.onConnection) {
      opts.onConnection(ws);
    } else {
      // Default: auto-respond to connect with hello-ok
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "req" && msg.method === "connect") {
          ws.send(
            JSON.stringify({
              type: "res",
              id: msg.id,
              ok: true,
              payload: {
                type: "hello-ok",
                protocol: 3,
                server: { version: "test", connId: randomUUID() },
                policy: { tickIntervalMs: 30000 },
              },
            }),
          );
        }
      });
    }
  });

  return {
    wss,
    port,
    url: `ws://127.0.0.1:${port}`,
    clients,
    close: () =>
      new Promise<void>((resolve) => {
        for (const c of clients) {
          try {
            c.close();
          } catch {}
        }
        wss.close(() => resolve());
      }),
  };
}

describe("client/gateway-client", () => {
  let server: MockServer;
  let client: GatewayClient;

  afterEach(async () => {
    if (client) {
      await client.stopAndWait();
    }
    if (server) {
      await server.close();
    }
  });

  it("connects with challenge-nonce handshake", async () => {
    server = await createMockGateway();
    const identity = generateIdentity();
    const helloOk = vi.fn();

    client = new GatewayClient({
      url: server.url,
      deviceIdentity: identity,
      onHelloOk: helloOk,
    });
    client.start();

    await vi.waitFor(() => expect(helloOk).toHaveBeenCalled(), { timeout: 2000 });
    const hello = helloOk.mock.calls[0][0];
    expect(hello.protocol).toBe(3);
    expect(client.isConnected()).toBe(true);
  });

  it("request/response correlation works", async () => {
    server = await createMockGateway({
      onConnection: (ws) => {
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
          } else if (msg.type === "req" && msg.method === "test.echo") {
            ws.send(
              JSON.stringify({
                type: "res",
                id: msg.id,
                ok: true,
                payload: { echo: msg.params },
              }),
            );
          }
        });
      },
    });
    const identity = generateIdentity();
    const connected = vi.fn();

    client = new GatewayClient({
      url: server.url,
      deviceIdentity: identity,
      onHelloOk: connected,
    });
    client.start();

    await vi.waitFor(() => expect(connected).toHaveBeenCalled(), { timeout: 2000 });

    const result = await client.request<{ echo: unknown }>("test.echo", {
      hello: "world",
    });
    expect(result.echo).toEqual({ hello: "world" });
  });

  it("handles connect challenge timeout", async () => {
    const port = await findFreePort();
    // Server that sends NO challenge
    const wss = new WebSocketServer({ port });
    wss.on("connection", () => {
      // intentionally do nothing
    });

    const connectError = vi.fn();
    const identity = generateIdentity();

    client = new GatewayClient({
      url: `ws://127.0.0.1:${port}`,
      deviceIdentity: identity,
      connectTimeoutMs: 200,
      onConnectError: connectError,
    });
    client.start();

    await vi.waitFor(() => expect(connectError).toHaveBeenCalled(), { timeout: 1000 });
    expect(connectError.mock.calls[0][0].message).toContain("challenge timeout");

    await client.stopAndWait();
    await new Promise<void>((resolve) => wss.close(() => resolve()));
    server = null as unknown as MockServer; // prevent double-close in afterEach
  });

  it("dispatches events to onEvent callback", async () => {
    server = await createMockGateway();
    const identity = generateIdentity();
    const onEvent = vi.fn();
    const connected = vi.fn();

    client = new GatewayClient({
      url: server.url,
      deviceIdentity: identity,
      onEvent,
      onHelloOk: connected,
    });
    client.start();

    await vi.waitFor(() => expect(connected).toHaveBeenCalled(), { timeout: 2000 });

    // Send a custom event
    server.clients[0].send(
      JSON.stringify({
        type: "event",
        event: "node.invoke.request",
        payload: { id: "test", command: "system.run" },
      }),
    );

    await vi.waitFor(
      () =>
        expect(onEvent).toHaveBeenCalledWith(
          expect.objectContaining({ event: "node.invoke.request" }),
        ),
      { timeout: 1000 },
    );
  });

  it("reconnects after server closes connection", async () => {
    server = await createMockGateway();
    const identity = generateIdentity();
    const helloOk = vi.fn();

    client = new GatewayClient({
      url: server.url,
      deviceIdentity: identity,
      onHelloOk: helloOk,
    });
    client.start();

    await vi.waitFor(() => expect(helloOk).toHaveBeenCalledTimes(1), { timeout: 2000 });

    // Close all existing client connections
    for (const c of server.clients) {
      c.close();
    }

    // Should reconnect
    await vi.waitFor(() => expect(helloOk).toHaveBeenCalledTimes(2), { timeout: 5000 });
  });
});
