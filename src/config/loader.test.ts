import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig, saveConfig, ensureConfigDir } from "./loader.js";

describe("config/loader", () => {
  let tmpDir: string;
  let env: NodeJS.ProcessEnv;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nodeclaw-test-"));
    env = { NODECLAW_HOME: tmpDir };
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns defaults when no config file exists", () => {
    const config = loadConfig(env);
    expect(config.gateway.url).toBe("ws://127.0.0.1:18789");
  });

  it("saves and reloads config", () => {
    const config = loadConfig(env);
    config.gateway.url = "wss://test:18789";
    config.device.name = "test-node";
    saveConfig(config, env);

    const reloaded = loadConfig(env);
    expect(reloaded.gateway.url).toBe("wss://test:18789");
    expect(reloaded.device.name).toBe("test-node");
  });

  it("returns defaults for corrupted config file", () => {
    ensureConfigDir(env);
    const configPath = path.join(tmpDir, "config.json");
    fs.writeFileSync(configPath, "not json");

    const config = loadConfig(env);
    expect(config.gateway.url).toBe("ws://127.0.0.1:18789");
  });

  it("ensureConfigDir creates the directory", () => {
    const subDir = path.join(tmpDir, "sub");
    ensureConfigDir({ NODECLAW_HOME: subDir });
    expect(fs.existsSync(subDir)).toBe(true);
  });
});
