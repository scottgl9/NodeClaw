import fs from "node:fs";
import path from "node:path";
import { NodeClawConfigSchema, type NodeClawConfig } from "./schema.js";
import { resolveBaseDir, resolveConfigPath } from "./paths.js";

export function ensureConfigDir(env?: NodeJS.ProcessEnv): void {
  const baseDir = resolveBaseDir(env);
  fs.mkdirSync(baseDir, { recursive: true });
}

export function loadConfig(env?: NodeJS.ProcessEnv): NodeClawConfig {
  const configPath = resolveConfigPath(env);
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      return NodeClawConfigSchema.parse(parsed);
    }
  } catch {
    // Fall through to defaults
  }
  return NodeClawConfigSchema.parse({});
}

export function saveConfig(
  config: NodeClawConfig,
  env?: NodeJS.ProcessEnv,
): void {
  const configPath = resolveConfigPath(env);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, {
    mode: 0o600,
  });
}
