import { describe, expect, it, vi } from "vitest";
import { systemRunPrepareHandler } from "./system-run-prepare.js";
import type { GatewayClient } from "../client/index.js";
import type { NodeInvokeRequestPayload } from "../protocol/index.js";

describe("handlers/system-run-prepare", () => {
  it("builds approval plan from command array", async () => {
    const mockClient = { request: vi.fn(async () => ({})) } as unknown as GatewayClient;
    const payload: NodeInvokeRequestPayload = {
      id: "inv-1",
      nodeId: "node-1",
      command: "system.run.prepare",
      paramsJSON: JSON.stringify({
        command: ["ls", "-la"],
        cwd: "/tmp",
        agentId: "agent-1",
        sessionKey: "sess-1",
      }),
    };

    await systemRunPrepareHandler(payload, mockClient);
    const call = mockClient.request.mock.calls[0];
    const result = call[1] as { payloadJSON: string };
    const { plan } = JSON.parse(result.payloadJSON);
    expect(plan.argv).toEqual(["ls", "-la"]);
    expect(plan.cwd).toBe("/tmp");
    expect(plan.commandText).toBe("ls -la");
    expect(plan.agentId).toBe("agent-1");
    expect(plan.sessionKey).toBe("sess-1");
  });

  it("builds plan from rawCommand", async () => {
    const mockClient = { request: vi.fn(async () => ({})) } as unknown as GatewayClient;
    const payload: NodeInvokeRequestPayload = {
      id: "inv-1",
      nodeId: "node-1",
      command: "system.run.prepare",
      paramsJSON: JSON.stringify({ rawCommand: "echo hello" }),
    };

    await systemRunPrepareHandler(payload, mockClient);
    const call = mockClient.request.mock.calls[0];
    const result = call[1] as { payloadJSON: string };
    const { plan } = JSON.parse(result.payloadJSON);
    expect(plan.argv).toEqual(["sh", "-c", "echo hello"]);
  });

  it("rejects missing command", async () => {
    const mockClient = { request: vi.fn(async () => ({})) } as unknown as GatewayClient;
    const payload: NodeInvokeRequestPayload = {
      id: "inv-1",
      nodeId: "node-1",
      command: "system.run.prepare",
      paramsJSON: JSON.stringify({}),
    };

    await systemRunPrepareHandler(payload, mockClient);
    const call = mockClient.request.mock.calls[0];
    const result = call[1] as { ok: boolean };
    expect(result.ok).toBe(false);
  });

  it("generates commandPreview for long commands", async () => {
    const mockClient = { request: vi.fn(async () => ({})) } as unknown as GatewayClient;
    const payload: NodeInvokeRequestPayload = {
      id: "inv-1",
      nodeId: "node-1",
      command: "system.run.prepare",
      paramsJSON: JSON.stringify({
        command: ["npm", "run", "build", "--production", "--verbose"],
      }),
    };

    await systemRunPrepareHandler(payload, mockClient);
    const call = mockClient.request.mock.calls[0];
    const result = call[1] as { payloadJSON: string };
    const { plan } = JSON.parse(result.payloadJSON);
    expect(plan.commandPreview).toBe("npm run build...");
  });
});
