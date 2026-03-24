import fs from "node:fs";
import type { Command } from "commander";
import {
  loadConfig,
  resolveBaseDir,
  resolveConfigPath,
  resolveIdentityPath,
  resolveTokenStorePath,
} from "../config/index.js";
import { loadOrCreateIdentity, loadDeviceAuthToken } from "../crypto/index.js";

type Check = {
  name: string;
  status: "ok" | "warn" | "fail";
  detail: string;
};

function runChecks(): Check[] {
  const checks: Check[] = [];

  // Node.js version
  const nodeVersion = parseInt(process.version.slice(1), 10);
  checks.push({
    name: "Node.js version",
    status: nodeVersion >= 20 ? "ok" : "fail",
    detail: `${process.version} ${nodeVersion >= 20 ? "(>= 20)" : "(requires >= 20)"}`,
  });

  // Config directory
  const baseDir = resolveBaseDir();
  checks.push({
    name: "Config directory",
    status: fs.existsSync(baseDir) ? "ok" : "warn",
    detail: baseDir,
  });

  // Config file
  const configPath = resolveConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      loadConfig();
      checks.push({ name: "Config file", status: "ok", detail: configPath });
    } catch {
      checks.push({
        name: "Config file",
        status: "fail",
        detail: `${configPath} (invalid)`,
      });
    }
  } else {
    checks.push({
      name: "Config file",
      status: "warn",
      detail: `${configPath} (not found, using defaults)`,
    });
  }

  // Device identity
  const identityPath = resolveIdentityPath();
  if (fs.existsSync(identityPath)) {
    try {
      const identity = loadOrCreateIdentity(identityPath);
      checks.push({
        name: "Device identity",
        status: "ok",
        detail: `${identity.deviceId.slice(0, 16)}...`,
      });
    } catch {
      checks.push({
        name: "Device identity",
        status: "fail",
        detail: `${identityPath} (corrupt)`,
      });
    }
  } else {
    checks.push({
      name: "Device identity",
      status: "warn",
      detail: "Not initialized (will be created on first pair)",
    });
  }

  // Pairing token
  const tokenStorePath = resolveTokenStorePath();
  try {
    const identity = loadOrCreateIdentity(identityPath);
    const token = loadDeviceAuthToken(
      tokenStorePath,
      identity.deviceId,
      "node",
    );
    checks.push({
      name: "Pairing token",
      status: token ? "ok" : "warn",
      detail: token ? "Stored" : "Not paired",
    });
  } catch {
    checks.push({
      name: "Pairing token",
      status: "warn",
      detail: "Cannot check (no identity)",
    });
  }

  // Gateway URL
  const config = loadConfig();
  checks.push({
    name: "Gateway URL",
    status: config.gateway.url ? "ok" : "fail",
    detail: config.gateway.url || "(not configured)",
  });

  // Workdir
  if (config.device.workdir) {
    const exists = fs.existsSync(config.device.workdir);
    checks.push({
      name: "Workdir",
      status: exists ? "ok" : "fail",
      detail: `${config.device.workdir} ${exists ? "" : "(not found)"}`,
    });
  } else {
    checks.push({
      name: "Workdir",
      status: "warn",
      detail: "Not configured (exec allowed anywhere)",
    });
  }

  return checks;
}

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Check configuration, connectivity, and service status")
    .action(() => {
      const checks = runChecks();
      let hasFailures = false;

      for (const check of checks) {
        const icon =
          check.status === "ok"
            ? "[OK]  "
            : check.status === "warn"
              ? "[WARN]"
              : "[FAIL]";
        if (check.status === "fail") {
          hasFailures = true;
        }
        console.log(`${icon} ${check.name}: ${check.detail}`);
      }

      if (hasFailures) {
        process.exitCode = 1;
      }
    });
}

// For testing
export { runChecks };
