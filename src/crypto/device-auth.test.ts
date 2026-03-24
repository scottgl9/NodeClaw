import { describe, expect, it } from "vitest";
import { buildDeviceAuthPayloadV3 } from "./device-auth.js";

describe("crypto/device-auth", () => {
  it("builds v3 payload with all fields", () => {
    const payload = buildDeviceAuthPayloadV3({
      deviceId: "abc123",
      clientId: "nodeclaw",
      clientMode: "node",
      role: "node",
      scopes: ["node.invoke"],
      signedAtMs: 1711300000000,
      token: "tok_xxx",
      nonce: "nonce123",
      platform: "Linux",
      deviceFamily: "RPi4",
    });
    expect(payload).toBe(
      "v3|abc123|nodeclaw|node|node|node.invoke|1711300000000|tok_xxx|nonce123|linux|rpi4",
    );
  });

  it("handles empty optional fields", () => {
    const payload = buildDeviceAuthPayloadV3({
      deviceId: "abc123",
      clientId: "nodeclaw",
      clientMode: "node",
      role: "node",
      scopes: [],
      signedAtMs: 1711300000000,
      nonce: "nonce123",
    });
    expect(payload).toBe(
      "v3|abc123|nodeclaw|node|node||1711300000000||nonce123||",
    );
  });

  it("normalizes platform to ASCII-lowercase", () => {
    const payload = buildDeviceAuthPayloadV3({
      deviceId: "abc",
      clientId: "nc",
      clientMode: "node",
      role: "node",
      scopes: [],
      signedAtMs: 0,
      nonce: "n",
      platform: "Darwin",
      deviceFamily: "MacBookPro",
    });
    expect(payload).toContain("|darwin|macbookpro");
  });

  it("joins multiple scopes with comma", () => {
    const payload = buildDeviceAuthPayloadV3({
      deviceId: "abc",
      clientId: "nc",
      clientMode: "node",
      role: "node",
      scopes: ["a.scope", "b.scope"],
      signedAtMs: 0,
      nonce: "n",
    });
    expect(payload).toContain("|a.scope,b.scope|");
  });
});
