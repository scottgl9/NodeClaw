import { randomUUID } from "node:crypto";
import net from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocketServer } from "ws";
import { generateIdentity } from "../crypto/index.js";
import { GatewayClient } from "../client/index.js";
import { CommandRouter } from "./router.js";
import { coerceNodeInvokePayload, type NodeInvokeRequestPayload } from "../protocol/index.js";

function findFreePort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
  });
}

describe("runtime/router", () => {
  it("dispatches to registered handler", async () => {
    const router = new CommandRouter();
    const handler = vi.fn(async () => {});
    router.register("test.cmd", handler);

    const payload: NodeInvokeRequestPayload = {
      id: randomUUID(),
      nodeId: "node-1",
      command: "test.cmd",
      paramsJSON: '{"key":"value"}',
    };

    // Create a mock client with a minimal request method
    const mockClient = {
      request: vi.fn(async () => ({})),
    } as unknown as GatewayClient;

    await router.dispatch(payload, mockClient);
    expect(handler).toHaveBeenCalledWith(payload, mockClient);
  });

  it("sends error for unknown command", async () => {
    const router = new CommandRouter();
    const mockClient = {
      request: vi.fn(async () => ({})),
    } as unknown as GatewayClient;

    const payload: NodeInvokeRequestPayload = {
      id: "inv-1",
      nodeId: "node-1",
      command: "unknown.cmd",
    };

    await router.dispatch(payload, mockClient);
    expect(mockClient.request).toHaveBeenCalledWith(
      "node.invoke.result",
      expect.objectContaining({
        id: "inv-1",
        ok: false,
        error: expect.objectContaining({ code: "UNKNOWN_COMMAND" }),
      }),
    );
  });

  it("integration: receives invoke event and dispatches", async () => {
    const port = await findFreePort();
    const wss = new WebSocketServer({ port });
    const identity = generateIdentity();
    const router = new CommandRouter();
    const handlerCalled = vi.fn();

    router.register("system.run", async (payload) => {
      handlerCalled(payload);
    });

    let serverWs: any;
    wss.on("connection", (ws) => {
      serverWs = ws;
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

    const connected = vi.fn();
    const client = new GatewayClient({
      url: `ws://127.0.0.1:${port}`,
      deviceIdentity: identity,
      onHelloOk: connected,
      onEvent: (evt) => {
        if (evt.event === "node.invoke.request") {
          const invokePayload = coerceNodeInvokePayload(evt.payload);
          if (invokePayload) {
            void router.dispatch(invokePayload, client);
          }
        }
      },
    });
    client.start();

    await vi.waitFor(() => expect(connected).toHaveBeenCalled(), { timeout: 2000 });

    // Send an invoke request from "gateway" to "node"
    serverWs.send(
      JSON.stringify({
        type: "event",
        event: "node.invoke.request",
        payload: {
          id: "invoke-1",
          nodeId: identity.deviceId,
          command: "system.run",
          paramsJSON: '{"command":["ls"]}',
        },
      }),
    );

    await vi.waitFor(() => expect(handlerCalled).toHaveBeenCalled(), { timeout: 2000 });
    expect(handlerCalled.mock.calls[0][0].command).toBe("system.run");

    await client.stopAndWait();
    await new Promise<void>((resolve) => wss.close(() => resolve()));
  });
});
