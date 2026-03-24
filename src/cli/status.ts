import type { Command } from "commander";
import {
  loadConfig,
  resolveIdentityPath,
  resolveTokenStorePath,
} from "../config/index.js";
import { loadOrCreateIdentity, loadDeviceAuthToken } from "../crypto/index.js";

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show connection and pairing status")
    .action(() => {
      const config = loadConfig();
      const identityPath = resolveIdentityPath();
      const tokenStorePath = resolveTokenStorePath();

      let identity;
      try {
        identity = loadOrCreateIdentity(identityPath);
      } catch {
        console.log("Device identity: not initialized");
        return;
      }

      const token = loadDeviceAuthToken(
        tokenStorePath,
        identity.deviceId,
        "node",
      );

      console.log(`Gateway URL:  ${config.gateway.url}`);
      console.log(`Device name:  ${config.device.name || "(default)"}`);
      console.log(`Device ID:    ${identity.deviceId}`);
      console.log(`Paired:       ${token ? "yes" : "no"}`);
      if (config.device.workdir) {
        console.log(`Workdir:      ${config.device.workdir}`);
      }
    });
}
