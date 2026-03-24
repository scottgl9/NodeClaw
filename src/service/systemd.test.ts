import { describe, expect, it } from "vitest";
import { generateSystemdUnit } from "./systemd.js";

describe("service/systemd", () => {
  it("generates valid systemd unit file", () => {
    const unit = generateSystemdUnit({
      execPath: "/usr/local/bin/nodeclaw",
      user: "testuser",
      workdir: "/home/testuser",
    });
    expect(unit).toContain("[Unit]");
    expect(unit).toContain("[Service]");
    expect(unit).toContain("[Install]");
    expect(unit).toContain("ExecStart=/usr/local/bin/nodeclaw start");
    expect(unit).toContain("User=testuser");
    expect(unit).toContain("WorkingDirectory=/home/testuser");
    expect(unit).toContain("Restart=always");
    expect(unit).toContain("WantedBy=multi-user.target");
  });

  it("includes network dependency", () => {
    const unit = generateSystemdUnit({ execPath: "/bin/nodeclaw" });
    expect(unit).toContain("After=network-online.target");
  });
});
