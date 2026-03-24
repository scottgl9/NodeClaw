import fs from "node:fs";
import type { Command } from "commander";
import {
  resolveIdentityPath,
  resolveTokenStorePath,
} from "../config/index.js";
import {
  loadOrCreateIdentity,
  clearDeviceAuthToken,
} from "../crypto/index.js";

export function registerUnpairCommand(program: Command): void {
  program
    .command("unpair")
    .description("Remove pairing token and disconnect")
    .option("--full", "Also delete device identity (generates new ID on next pair)")
    .action((opts: { full?: boolean }) => {
      const identityPath = resolveIdentityPath();
      const tokenStorePath = resolveTokenStorePath();

      try {
        const identity = loadOrCreateIdentity(identityPath);
        clearDeviceAuthToken(tokenStorePath, identity.deviceId, "node");
        console.log("Pairing token removed.");
      } catch {
        console.log("No pairing token found.");
      }

      if (opts.full) {
        try {
          if (fs.existsSync(identityPath)) {
            fs.unlinkSync(identityPath);
            console.log("Device identity deleted.");
          }
        } catch (err) {
          console.error(
            `Failed to delete identity: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    });
}
