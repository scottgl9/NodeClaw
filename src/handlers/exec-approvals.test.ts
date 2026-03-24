import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createExecApprovalsGetHandler,
  createExecApprovalsSetHandler,
} from "./exec-approvals.js";
import type { GatewayClient } from "../client/index.js";
import type { NodeInvokeRequestPayload } from "../protocol/index.js";

describe("handlers/exec-approvals", () => {
  let tmpDir: string;
  let env: NodeJS.ProcessEnv;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nodeclaw-ea-"));
    env = { NODECLAW_HOME: tmpDir };
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("get returns default snapshot when no file exists", async () => {
    const handler = createExecApprovalsGetHandler(env);
    const mockClient = { request: vi.fn(async () => ({})) } as unknown as GatewayClient;
    const payload: NodeInvokeRequestPayload = {
      id: "inv-1",
      nodeId: "node-1",
      command: "system.execApprovals.get",
    };

    await handler(payload, mockClient);
    const call = mockClient.request.mock.calls[0];
    const result = call[1] as { payloadJSON: string };
    const snapshot = JSON.parse(result.payloadJSON);
    expect(snapshot.exists).toBe(false);
    expect(snapshot.file.version).toBe(1);
    expect(snapshot.hash).toBeTruthy();
  });

  it("set writes file and returns snapshot", async () => {
    const setHandler = createExecApprovalsSetHandler(env);
    const mockClient = { request: vi.fn(async () => ({})) } as unknown as GatewayClient;

    const file = {
      version: 1,
      defaults: { security: "allowlist", ask: "on-miss" },
    };
    const payload: NodeInvokeRequestPayload = {
      id: "inv-1",
      nodeId: "node-1",
      command: "system.execApprovals.set",
      paramsJSON: JSON.stringify({ file }),
    };

    await setHandler(payload, mockClient);
    const call = mockClient.request.mock.calls[0];
    const result = call[1] as { payloadJSON: string };
    const snapshot = JSON.parse(result.payloadJSON);
    expect(snapshot.exists).toBe(true);
    expect(snapshot.file.defaults.security).toBe("allowlist");

    // Verify get returns the same
    const getHandler = createExecApprovalsGetHandler(env);
    await getHandler(
      { id: "inv-2", nodeId: "node-1", command: "system.execApprovals.get" },
      mockClient,
    );
    const getResult = mockClient.request.mock.calls[1][1] as { payloadJSON: string };
    const getSnapshot = JSON.parse(getResult.payloadJSON);
    expect(getSnapshot.file.defaults.security).toBe("allowlist");
  });

  it("set rejects on hash mismatch", async () => {
    const setHandler = createExecApprovalsSetHandler(env);
    const mockClient = { request: vi.fn(async () => ({})) } as unknown as GatewayClient;

    // Write initial file
    await setHandler(
      {
        id: "inv-1",
        nodeId: "node-1",
        command: "system.execApprovals.set",
        paramsJSON: JSON.stringify({ file: { version: 1 } }),
      },
      mockClient,
    );

    // Try to update with wrong base hash
    await setHandler(
      {
        id: "inv-2",
        nodeId: "node-1",
        command: "system.execApprovals.set",
        paramsJSON: JSON.stringify({
          file: { version: 1 },
          baseHash: "wrong-hash",
        }),
      },
      mockClient,
    );

    const errorCall = mockClient.request.mock.calls[1][1] as { ok: boolean; error?: { code: string } };
    expect(errorCall.ok).toBe(false);
    expect(errorCall.error?.code).toBe("HASH_MISMATCH");
  });
});
