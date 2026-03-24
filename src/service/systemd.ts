import os from "node:os";
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

export function generateSystemdUnit(opts: SystemdOptions = {}): string {
  const execPath = opts.execPath || resolveNodeClawPath();
  const user = opts.user || os.userInfo().username;
  const workdir = opts.workdir || os.homedir();

  return `[Unit]
Description=NodeClaw - OpenClaw Node Client
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${execPath} start
Restart=always
RestartSec=5
User=${user}
WorkingDirectory=${workdir}
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
`;
}
