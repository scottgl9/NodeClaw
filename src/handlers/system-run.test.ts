import { describe, expect, it, vi } from "vitest";
import {
  parseRunParams,
  isPathWithinWorkdir,
  isBlockedCommand,
  runCommand,
  createSystemRunHandler,
  type SystemRunParams,
} from "./system-run.js";
import type { GatewayClient } from "../client/index.js";
import type { NodeInvokeRequestPayload } from "../protocol/index.js";

describe("handlers/system-run", () => {
  describe("parseRunParams", () => {
    it("parses valid params with array command", () => {
      const result = parseRunParams('{"command":["ls","-la"],"cwd":"/tmp"}');
      expect(result).toEqual({
        command: ["ls", "-la"],
        cwd: "/tmp",
        env: undefined,
        timeoutMs: undefined,
      });
    });

    it("parses string command as single-element array", () => {
      const result = parseRunParams('{"command":"echo hello"}');
      expect(result).toEqual({
        command: ["echo hello"],
        cwd: undefined,
        env: undefined,
        timeoutMs: undefined,
      });
    });

    it("returns null for missing command", () => {
      expect(parseRunParams('{"cwd":"/tmp"}')).toBeNull();
    });

    it("returns null for null input", () => {
      expect(parseRunParams(null)).toBeNull();
    });

    it("returns null for invalid JSON", () => {
      expect(parseRunParams("not json")).toBeNull();
    });
  });

  describe("isPathWithinWorkdir", () => {
    it("allows paths within workdir", () => {
      expect(isPathWithinWorkdir("/home/user/work/sub", "/home/user/work")).toBe(true);
    });

    it("allows exact workdir", () => {
      expect(isPathWithinWorkdir("/home/user/work", "/home/user/work")).toBe(true);
    });

    it("rejects paths outside workdir", () => {
      expect(isPathWithinWorkdir("/etc/passwd", "/home/user/work")).toBe(false);
    });

    it("rejects path traversal", () => {
      expect(isPathWithinWorkdir("/home/user/work/../other", "/home/user/work")).toBe(false);
    });

    it("allows any path when workdir is empty", () => {
      expect(isPathWithinWorkdir("/any/path", "")).toBe(true);
    });
  });

  describe("isBlockedCommand", () => {
    it("blocks exact match", () => {
      expect(isBlockedCommand(["rm", "-rf", "/"], ["rm -rf /"])).toBe(true);
    });

    it("blocks prefix match", () => {
      expect(isBlockedCommand(["sudo", "rm"], ["sudo"])).toBe(true);
    });

    it("allows non-blocked commands", () => {
      expect(isBlockedCommand(["ls"], ["sudo"])).toBe(false);
    });

    it("allows when no blocked commands", () => {
      expect(isBlockedCommand(["rm", "-rf", "/"], [])).toBe(false);
    });
  });

  describe("runCommand", () => {
    it("executes echo and captures stdout", async () => {
      const params: SystemRunParams = { command: ["echo", "hello world"] };
      const result = await runCommand(params, {
        blockedCommands: [],
        timeoutMs: 5000,
        maxConcurrent: 3,
      });
      expect(result.stdout.trim()).toBe("hello world");
      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
      expect(result.truncated).toBe(false);
    });

    it("captures stderr", async () => {
      const params: SystemRunParams = {
        command: ["sh", "-c", "echo error >&2"],
      };
      const result = await runCommand(params, {
        blockedCommands: [],
        timeoutMs: 5000,
        maxConcurrent: 3,
      });
      expect(result.stderr.trim()).toBe("error");
    });

    it("reports non-zero exit code", async () => {
      const params: SystemRunParams = {
        command: ["sh", "-c", "exit 42"],
      };
      const result = await runCommand(params, {
        blockedCommands: [],
        timeoutMs: 5000,
        maxConcurrent: 3,
      });
      expect(result.exitCode).toBe(42);
    });

    it("enforces timeout", async () => {
      const params: SystemRunParams = {
        command: ["sleep", "10"],
        timeoutMs: 100,
      };
      const result = await runCommand(params, {
        blockedCommands: [],
        timeoutMs: 60000,
        maxConcurrent: 3,
      });
      expect(result.timedOut).toBe(true);
    });

    it("handles command not found", async () => {
      const params: SystemRunParams = {
        command: ["nonexistent_command_xyz"],
      };
      const result = await runCommand(params, {
        blockedCommands: [],
        timeoutMs: 5000,
        maxConcurrent: 3,
      });
      expect(result.exitCode).toBeNull();
      expect(result.stderr).toContain("ENOENT");
    });
  });

  describe("createSystemRunHandler", () => {
    it("sends error for invalid params", async () => {
      const handler = createSystemRunHandler(
        { blockedCommands: [], timeoutMs: 5000, maxConcurrent: 3 },
        "",
      );
      const mockClient = { request: vi.fn(async () => ({})) } as unknown as GatewayClient;
      const payload: NodeInvokeRequestPayload = {
        id: "inv-1",
        nodeId: "node-1",
        command: "system.run",
        paramsJSON: "invalid",
      };

      await handler(payload, mockClient);
      expect(mockClient.request).toHaveBeenCalledWith(
        "node.invoke.result",
        expect.objectContaining({
          ok: false,
          error: expect.objectContaining({ code: "INVALID_PARAMS" }),
        }),
      );
    });

    it("sends error for blocked command", async () => {
      const handler = createSystemRunHandler(
        { blockedCommands: ["sudo"], timeoutMs: 5000, maxConcurrent: 3 },
        "",
      );
      const mockClient = { request: vi.fn(async () => ({})) } as unknown as GatewayClient;
      const payload: NodeInvokeRequestPayload = {
        id: "inv-1",
        nodeId: "node-1",
        command: "system.run",
        paramsJSON: '{"command":["sudo","rm"]}',
      };

      await handler(payload, mockClient);
      expect(mockClient.request).toHaveBeenCalledWith(
        "node.invoke.result",
        expect.objectContaining({
          ok: false,
          error: expect.objectContaining({ code: "BLOCKED" }),
        }),
      );
    });

    it("sends error for workdir violation", async () => {
      const handler = createSystemRunHandler(
        { blockedCommands: [], timeoutMs: 5000, maxConcurrent: 3 },
        "/home/user/work",
      );
      const mockClient = { request: vi.fn(async () => ({})) } as unknown as GatewayClient;
      const payload: NodeInvokeRequestPayload = {
        id: "inv-1",
        nodeId: "node-1",
        command: "system.run",
        paramsJSON: '{"command":["ls"],"cwd":"/etc"}',
      };

      await handler(payload, mockClient);
      expect(mockClient.request).toHaveBeenCalledWith(
        "node.invoke.result",
        expect.objectContaining({
          ok: false,
          error: expect.objectContaining({ code: "WORKDIR_VIOLATION" }),
        }),
      );
    });

    it("executes command and sends result", async () => {
      const handler = createSystemRunHandler(
        { blockedCommands: [], timeoutMs: 5000, maxConcurrent: 3 },
        "",
      );
      const mockClient = { request: vi.fn(async () => ({})) } as unknown as GatewayClient;
      const payload: NodeInvokeRequestPayload = {
        id: "inv-1",
        nodeId: "node-1",
        command: "system.run",
        paramsJSON: '{"command":["echo","test"]}',
      };

      await handler(payload, mockClient);
      expect(mockClient.request).toHaveBeenCalledWith(
        "node.invoke.result",
        expect.objectContaining({
          id: "inv-1",
          ok: true,
        }),
      );
      const resultCall = mockClient.request.mock.calls[0];
      const resultParams = resultCall[1] as { payloadJSON: string };
      const parsed = JSON.parse(resultParams.payloadJSON);
      expect(parsed.stdout.trim()).toBe("test");
      expect(parsed.exitCode).toBe(0);
    });
  });
});
