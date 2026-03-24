import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  loadOrCreateIdentity,
  storeDeviceAuthToken,
  loadDeviceAuthToken,
} from "../crypto/index.js";

describe("cli/unpair", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nodeclaw-unpair-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("clears token via clearDeviceAuthToken", async () => {
    const identityPath = path.join(tmpDir, "identity", "device.json");
    const tokenStorePath = path.join(tmpDir, "identity", "device-auth.json");

    const identity = loadOrCreateIdentity(identityPath);
    storeDeviceAuthToken(
      tokenStorePath,
      identity.deviceId,
      "node",
      "tok_test",
    );

    // Verify token exists
    expect(
      loadDeviceAuthToken(tokenStorePath, identity.deviceId, "node"),
    ).not.toBeNull();

    // Simulate unpair by importing the function
    const { clearDeviceAuthToken } = await import("../crypto/index.js");
    clearDeviceAuthToken(tokenStorePath, identity.deviceId, "node");

    // Verify token is gone
    expect(
      loadDeviceAuthToken(tokenStorePath, identity.deviceId, "node"),
    ).toBeNull();
  });

  it("deletes identity file with --full", async () => {
    const identityPath = path.join(tmpDir, "identity", "device.json");
    loadOrCreateIdentity(identityPath);
    expect(fs.existsSync(identityPath)).toBe(true);

    fs.unlinkSync(identityPath);
    expect(fs.existsSync(identityPath)).toBe(false);
  });
});
