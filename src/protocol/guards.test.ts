import { describe, expect, it } from "vitest";
import {
  isEventFrame,
  isResponseFrame,
  isRequestFrame,
  coerceNodeInvokePayload,
} from "./guards.js";

describe("protocol/guards", () => {
  describe("isEventFrame", () => {
    it("accepts valid event frame", () => {
      expect(isEventFrame({ type: "event", event: "tick", payload: {} })).toBe(true);
    });

    it("rejects response frame", () => {
      expect(isEventFrame({ type: "res", id: "1", ok: true })).toBe(false);
    });

    it("rejects null", () => {
      expect(isEventFrame(null)).toBe(false);
    });

    it("rejects missing event field", () => {
      expect(isEventFrame({ type: "event" })).toBe(false);
    });
  });

  describe("isResponseFrame", () => {
    it("accepts valid response frame", () => {
      expect(isResponseFrame({ type: "res", id: "abc", ok: true, payload: {} })).toBe(true);
    });

    it("accepts error response", () => {
      expect(
        isResponseFrame({ type: "res", id: "abc", ok: false, error: { code: "ERR" } }),
      ).toBe(true);
    });

    it("rejects event frame", () => {
      expect(isResponseFrame({ type: "event", event: "tick" })).toBe(false);
    });

    it("rejects missing ok field", () => {
      expect(isResponseFrame({ type: "res", id: "abc" })).toBe(false);
    });
  });

  describe("isRequestFrame", () => {
    it("accepts valid request frame", () => {
      expect(isRequestFrame({ type: "req", id: "abc", method: "connect" })).toBe(true);
    });

    it("rejects missing method", () => {
      expect(isRequestFrame({ type: "req", id: "abc" })).toBe(false);
    });
  });

  describe("coerceNodeInvokePayload", () => {
    it("parses valid invoke payload", () => {
      const result = coerceNodeInvokePayload({
        id: "inv-1",
        nodeId: "node-1",
        command: "system.run",
        paramsJSON: '{"command":["ls"]}',
        timeoutMs: 5000,
        idempotencyKey: "key-1",
      });
      expect(result).toEqual({
        id: "inv-1",
        nodeId: "node-1",
        command: "system.run",
        paramsJSON: '{"command":["ls"]}',
        timeoutMs: 5000,
        idempotencyKey: "key-1",
      });
    });

    it("returns null for missing id", () => {
      expect(coerceNodeInvokePayload({ command: "test" })).toBeNull();
    });

    it("returns null for non-object", () => {
      expect(coerceNodeInvokePayload("string")).toBeNull();
      expect(coerceNodeInvokePayload(null)).toBeNull();
    });

    it("handles missing optional fields", () => {
      const result = coerceNodeInvokePayload({
        id: "inv-1",
        command: "test",
      });
      expect(result).not.toBeNull();
      expect(result!.nodeId).toBe("");
      expect(result!.paramsJSON).toBeUndefined();
      expect(result!.timeoutMs).toBeUndefined();
    });
  });
});
