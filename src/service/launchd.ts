import os from "node:os";
import { execFileSync } from "node:child_process";

export type LaunchdOptions = {
  execPath?: string;
  workdir?: string;
  label?: string;
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

export function generateLaunchdPlist(opts: LaunchdOptions = {}): string {
  const execPath = opts.execPath || resolveNodeClawPath();
  const workdir = opts.workdir || os.homedir();
  const label = opts.label || "ai.nodeclaw";

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${execPath}</string>
    <string>start</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>WorkingDirectory</key>
  <string>${workdir}</string>
  <key>StandardOutPath</key>
  <string>/tmp/nodeclaw.stdout.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/nodeclaw.stderr.log</string>
</dict>
</plist>
`;
}
