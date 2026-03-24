import path from "node:path";
import os from "node:os";

export function resolveBaseDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.NODECLAW_HOME) {
    return env.NODECLAW_HOME;
  }
  return path.join(os.homedir(), ".nodeclaw");
}

export function resolveConfigPath(env?: NodeJS.ProcessEnv): string {
  return path.join(resolveBaseDir(env), "config.json");
}

export function resolveIdentityPath(env?: NodeJS.ProcessEnv): string {
  return path.join(resolveBaseDir(env), "identity", "device.json");
}

export function resolveTokenStorePath(env?: NodeJS.ProcessEnv): string {
  return path.join(resolveBaseDir(env), "identity", "device-auth.json");
}
