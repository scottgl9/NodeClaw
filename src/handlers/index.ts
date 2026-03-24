import { loadConfig } from "../config/index.js";
import type { CommandRouter } from "../runtime/router.js";
import { createSystemRunHandler } from "./system-run.js";
import { systemInfoHandler } from "./system-info.js";
import { systemWhichHandler } from "./system-which.js";

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

  router.register("system.info", (payload, client) =>
    systemInfoHandler(payload, client, workdir),
  );

  router.register("system.which", systemWhichHandler);
}
