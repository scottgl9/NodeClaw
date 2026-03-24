import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Command } from "commander";
import { generateSystemdUnit } from "../service/systemd.js";
import { generateLaunchdPlist } from "../service/launchd.js";
import { loadConfig } from "../config/index.js";

export function registerInstallServiceCommand(program: Command): void {
  program
    .command("install-service")
    .description("Install systemd (Linux) or launchd (macOS) service")
    .option("--dry-run", "Print the service file without writing")
    .action((opts: { dryRun?: boolean }) => {
      const config = loadConfig();
      const platform = process.platform;
      const workdir = config.device.workdir || os.homedir();

      if (platform === "linux") {
        const unit = generateSystemdUnit({ workdir });
        if (opts.dryRun) {
          console.log(unit);
          return;
        }
        const unitPath = path.join(
          os.homedir(),
          ".config",
          "systemd",
          "user",
          "nodeclaw.service",
        );
        fs.mkdirSync(path.dirname(unitPath), { recursive: true });
        fs.writeFileSync(unitPath, unit);
        console.log(`Service file written to ${unitPath}`);
        console.log("To enable: systemctl --user enable --now nodeclaw");
      } else if (platform === "darwin") {
        const plist = generateLaunchdPlist({ workdir });
        if (opts.dryRun) {
          console.log(plist);
          return;
        }
        const plistPath = path.join(
          os.homedir(),
          "Library",
          "LaunchAgents",
          "ai.nodeclaw.plist",
        );
        fs.mkdirSync(path.dirname(plistPath), { recursive: true });
        fs.writeFileSync(plistPath, plist);
        console.log(`Plist written to ${plistPath}`);
        console.log("To load: launchctl load " + plistPath);
      } else {
        console.error(`Service installation not supported on ${platform}`);
        process.exit(1);
      }
    });

  program
    .command("uninstall-service")
    .description("Remove installed service")
    .action(() => {
      const platform = process.platform;
      if (platform === "linux") {
        const unitPath = path.join(
          os.homedir(),
          ".config",
          "systemd",
          "user",
          "nodeclaw.service",
        );
        if (fs.existsSync(unitPath)) {
          fs.unlinkSync(unitPath);
          console.log("Service file removed.");
          console.log("Run: systemctl --user daemon-reload");
        } else {
          console.log("Service file not found.");
        }
      } else if (platform === "darwin") {
        const plistPath = path.join(
          os.homedir(),
          "Library",
          "LaunchAgents",
          "ai.nodeclaw.plist",
        );
        if (fs.existsSync(plistPath)) {
          fs.unlinkSync(plistPath);
          console.log("Plist removed.");
          console.log("Run: launchctl unload " + plistPath);
        } else {
          console.log("Plist not found.");
        }
      } else {
        console.error(`Service uninstall not supported on ${platform}`);
        process.exit(1);
      }
    });
}
