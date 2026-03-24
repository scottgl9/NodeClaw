import { loadConfig } from "../config/index.js";
import type { CommandRouter } from "../runtime/router.js";
import { createSystemRunHandler } from "./system-run.js";
import { systemRunPrepareHandler } from "./system-run-prepare.js";
import { systemInfoHandler } from "./system-info.js";
import { systemWhichHandler } from "./system-which.js";
import {
  createExecApprovalsGetHandler,
  createExecApprovalsSetHandler,
} from "./exec-approvals.js";

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

  router.register("system.run.prepare", systemRunPrepareHandler);

  router.register("system.info", (payload, client) =>
    systemInfoHandler(payload, client, workdir),
  );

  router.register("system.which", systemWhichHandler);

  router.register(
    "system.execApprovals.get",
    createExecApprovalsGetHandler(env),
  );

  router.register(
    "system.execApprovals.set",
    createExecApprovalsSetHandler(env),
  );
}
