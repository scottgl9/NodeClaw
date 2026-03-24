import { describe, expect, it } from "vitest";
import { getSystemInfo } from "./system-info.js";

describe("handlers/system-info", () => {
  it("returns system info with expected shape", () => {
    const info = getSystemInfo();
    expect(info.cpu.cores).toBeGreaterThan(0);
    expect(info.cpu.model).toBeTruthy();
    expect(info.memory.totalBytes).toBeGreaterThan(0);
    expect(info.memory.freeBytes).toBeGreaterThan(0);
    expect(info.memory.usedBytes).toBeGreaterThan(0);
    expect(info.uptime).toBeGreaterThan(0);
    expect(info.platform).toBeTruthy();
    expect(info.arch).toBeTruthy();
    expect(info.hostname).toBeTruthy();
    expect(info.nodeVersion).toMatch(/^v\d+/);
  });

  it("includes disk info for valid path", () => {
    const info = getSystemInfo("/");
    expect(info.disk).toBeDefined();
    expect(info.disk!.totalBytes).toBeGreaterThan(0);
    expect(info.disk!.freeBytes).toBeGreaterThan(0);
  });

  it("memory used = total - free", () => {
    const info = getSystemInfo();
    expect(info.memory.usedBytes).toBe(
      info.memory.totalBytes - info.memory.freeBytes,
    );
  });
});
