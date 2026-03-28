import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

export type SystemdOptions = {
  execPath?: string;
  user?: string;
  workdir?: string;
};

function resolveNodeClawPath(): string {
  try {
    return execFileSync("which", ["nodeclaw"], {
      encoding: "utf8",
      timeout: 5000,
    }).trim();
  } catch {
    return "/usr/local/bin/nodeclaw";
  }
}

/** Return the directory containing the current node binary. */
function resolveNodeBinDir(): string {
  return path.dirname(process.execPath);
}

export function generateSystemdUnit(opts: SystemdOptions = {}): string {
  const execPath = opts.execPath || resolveNodeClawPath();
  const workdir = opts.workdir || os.homedir();

  // Ensure the node binary directory is in PATH so /usr/bin/env node resolves
  // correctly even in systemd's minimal environment (e.g. when node comes from
  // nvm and isn't in /usr/local/bin).
  const nodeBinDir = resolveNodeBinDir();
  const pathEnv = `PATH=${nodeBinDir}:/usr/local/bin:/usr/bin:/bin`;

  // User-mode systemd services must NOT include User= (it belongs only in
  // system-wide unit files) and WantedBy must be default.target, not
  // multi-user.target (which is a system target unavailable to user managers).
  return `[Unit]
Description=NodeClaw - OpenClaw Node Client
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${execPath} start
Restart=always
RestartSec=5
WorkingDirectory=${workdir}
Environment=NODE_ENV=production
Environment=${pathEnv}

[Install]
WantedBy=default.target
`;
}
