import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveBaseDir, resolveConfigPath, resolveIdentityPath, resolveTokenStorePath } from "./paths.js";

describe("config/paths", () => {
  it("uses NODECLAW_HOME when set", () => {
    const base = resolveBaseDir({ NODECLAW_HOME: "/custom/path" });
    expect(base).toBe("/custom/path");
  });

  it("defaults to ~/.nodeclaw", () => {
    const base = resolveBaseDir({});
    expect(base).toBe(path.join(os.homedir(), ".nodeclaw"));
  });

  it("resolves config path", () => {
    const p = resolveConfigPath({ NODECLAW_HOME: "/tmp/nc" });
    expect(p).toBe("/tmp/nc/config.json");
  });

  it("resolves identity path", () => {
    const p = resolveIdentityPath({ NODECLAW_HOME: "/tmp/nc" });
    expect(p).toBe("/tmp/nc/identity/device.json");
  });

  it("resolves token store path", () => {
    const p = resolveTokenStorePath({ NODECLAW_HOME: "/tmp/nc" });
    expect(p).toBe("/tmp/nc/identity/device-auth.json");
  });
});
