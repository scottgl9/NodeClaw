import { describe, expect, it } from "vitest";
import { resolveWhich } from "./system-which.js";

describe("handlers/system-which", () => {
  it("finds node binary", () => {
    const result = resolveWhich(["node"]);
    expect(result.node).toBeTruthy();
    expect(result.node).toContain("node");
  });

  it("returns null for nonexistent binary", () => {
    const result = resolveWhich(["nonexistent_binary_xyz_123"]);
    expect(result.nonexistent_binary_xyz_123).toBeNull();
  });

  it("handles multiple bins", () => {
    const result = resolveWhich(["node", "nonexistent_abc"]);
    expect(result.node).toBeTruthy();
    expect(result.nonexistent_abc).toBeNull();
  });

  it("handles empty array", () => {
    const result = resolveWhich([]);
    expect(Object.keys(result)).toHaveLength(0);
  });
});
