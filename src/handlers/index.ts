import { loadConfig } from "../config/index.js";
import type { CommandRouter } from "../runtime/router.js";
import { createSystemRunHandler } from "./system-run.js";

export function registerAllHandlers(
  router: CommandRouter,
  env?: NodeJS.ProcessEnv,
): void {
  const config = loadConfig(env);
  const workdir = config.device.workdir;

  router.register(
    "system.run",
    createSystemRunHandler(config.exec, workdir),
  );
}
