import { describe, expect, it } from "vitest";
import { NodeClawConfigSchema } from "./schema.js";

describe("config/schema", () => {
  it("produces valid defaults from empty input", () => {
    const config = NodeClawConfigSchema.parse({});
    expect(config.gateway.url).toBe("ws://127.0.0.1:18789");
    expect(config.gateway.tlsVerify).toBe(true);
    expect(config.device.name).toBe("");
    expect(config.device.workdir).toBe("");
    expect(config.exec.blockedCommands).toEqual([]);
    expect(config.exec.timeoutMs).toBe(60_000);
    expect(config.exec.maxConcurrent).toBe(3);
    expect(config.log.level).toBe("info");
  });

  it("accepts a fully specified config", () => {
    const input = {
      gateway: { url: "wss://my-host:18789", tlsVerify: false },
      device: { name: "pi-node", workdir: "/tmp/work" },
      exec: { blockedCommands: ["rm -rf /"], timeoutMs: 30000, maxConcurrent: 1 },
      log: { level: "debug" as const, path: "/tmp/nodeclaw.log" },
    };
    const config = NodeClawConfigSchema.parse(input);
    expect(config.gateway.url).toBe("wss://my-host:18789");
    expect(config.exec.blockedCommands).toEqual(["rm -rf /"]);
    expect(config.log.level).toBe("debug");
  });

  it("rejects invalid gateway url", () => {
    expect(() =>
      NodeClawConfigSchema.parse({ gateway: { url: "not-a-url" } }),
    ).toThrow();
  });

  it("rejects invalid log level", () => {
    expect(() =>
      NodeClawConfigSchema.parse({ log: { level: "trace" } }),
    ).toThrow();
  });

  it("rejects negative timeoutMs", () => {
    expect(() =>
      NodeClawConfigSchema.parse({ exec: { timeoutMs: -1 } }),
    ).toThrow();
  });
});
