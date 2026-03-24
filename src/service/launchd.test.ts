import { describe, expect, it } from "vitest";
import { generateLaunchdPlist } from "./launchd.js";

describe("service/launchd", () => {
  it("generates valid plist", () => {
    const plist = generateLaunchdPlist({
      execPath: "/usr/local/bin/nodeclaw",
      workdir: "/Users/test",
      label: "ai.nodeclaw.test",
    });
    expect(plist).toContain("<?xml");
    expect(plist).toContain("<key>Label</key>");
    expect(plist).toContain("<string>ai.nodeclaw.test</string>");
    expect(plist).toContain("<string>/usr/local/bin/nodeclaw</string>");
    expect(plist).toContain("<string>start</string>");
    expect(plist).toContain("<key>KeepAlive</key>");
    expect(plist).toContain("<key>RunAtLoad</key>");
    expect(plist).toContain("<string>/Users/test</string>");
  });

  it("uses default label", () => {
    const plist = generateLaunchdPlist({ execPath: "/bin/nodeclaw" });
    expect(plist).toContain("<string>ai.nodeclaw</string>");
  });
});
