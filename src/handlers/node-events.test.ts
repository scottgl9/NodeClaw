import { describe, expect, it, vi } from "vitest";
import { emitExecStarted, emitExecFinished, emitExecDenied } from "./node-events.js";
import type { GatewayClient } from "../client/index.js";

describe("handlers/node-events", () => {
  it("emits exec.started event", async () => {
    const mockClient = { request: vi.fn(async () => ({})) } as unknown as GatewayClient;
    await emitExecStarted(mockClient, {
      sessionKey: "sess-1",
      runId: "run-1",
      command: "ls -la",
    });

    expect(mockClient.request).toHaveBeenCalledWith("node.event", {
      event: "exec.started",
      payloadJSON: expect.stringContaining('"runId":"run-1"'),
    });
  });

  it("emits exec.finished event with truncated output", async () => {
    const mockClient = { request: vi.fn(async () => ({})) } as unknown as GatewayClient;
    const longOutput = "x".repeat(30_000);
    await emitExecFinished(mockClient, {
      sessionKey: "sess-1",
      runId: "run-1",
      exitCode: 0,
      output: longOutput,
    });

    const call = mockClient.request.mock.calls[0];
    const params = call[1] as { payloadJSON: string };
    const payload = JSON.parse(params.payloadJSON);
    // Output should be truncated to 20KB
    expect(payload.output.length).toBe(20_000);
  });

  it("emits exec.denied event with reason", async () => {
    const mockClient = { request: vi.fn(async () => ({})) } as unknown as GatewayClient;
    await emitExecDenied(mockClient, {
      sessionKey: "sess-1",
      runId: "run-1",
      command: "sudo rm",
      reason: "allowlist-miss",
    });

    const call = mockClient.request.mock.calls[0];
    const params = call[1] as { payloadJSON: string };
    const payload = JSON.parse(params.payloadJSON);
    expect(payload.reason).toBe("allowlist-miss");
    expect(payload.host).toBe("node");
  });

  it("swallows errors silently", async () => {
    const mockClient = {
      request: vi.fn(async () => {
        throw new Error("connection lost");
      }),
    } as unknown as GatewayClient;

    // Should not throw
    await emitExecStarted(mockClient, {
      sessionKey: "s",
      runId: "r",
    });
  });
});
