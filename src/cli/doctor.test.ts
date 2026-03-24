import { describe, expect, it } from "vitest";
import { runChecks } from "./doctor.js";

describe("cli/doctor", () => {
  it("returns checks with expected names", () => {
    const checks = runChecks();
    const names = checks.map((c) => c.name);
    expect(names).toContain("Node.js version");
    expect(names).toContain("Gateway URL");
    expect(names).toContain("Device identity");
  });

  it("Node.js version check passes on Node 20+", () => {
    const checks = runChecks();
    const nodeCheck = checks.find((c) => c.name === "Node.js version");
    expect(nodeCheck).toBeDefined();
    expect(nodeCheck!.status).toBe("ok");
  });

  it("all checks have valid status", () => {
    const checks = runChecks();
    for (const check of checks) {
      expect(["ok", "warn", "fail"]).toContain(check.status);
    }
  });
});
