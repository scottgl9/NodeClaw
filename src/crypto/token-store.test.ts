import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  loadDeviceAuthToken,
  storeDeviceAuthToken,
  clearDeviceAuthToken,
} from "./token-store.js";

describe("crypto/token-store", () => {
  let tmpDir: string;
  let storePath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nodeclaw-token-"));
    storePath = path.join(tmpDir, "identity", "device-auth.json");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns null when no store exists", () => {
    const entry = loadDeviceAuthToken(storePath, "device1", "node");
    expect(entry).toBeNull();
  });

  it("stores and loads a token", () => {
    storeDeviceAuthToken(storePath, "device1", "node", "tok_abc", ["node.invoke"]);
    const entry = loadDeviceAuthToken(storePath, "device1", "node");
    expect(entry).not.toBeNull();
    expect(entry!.token).toBe("tok_abc");
    expect(entry!.scopes).toEqual(["node.invoke"]);
    expect(entry!.issuedAtMs).toBeGreaterThan(0);
  });

  it("returns null for wrong deviceId", () => {
    storeDeviceAuthToken(storePath, "device1", "node", "tok_abc");
    const entry = loadDeviceAuthToken(storePath, "device2", "node");
    expect(entry).toBeNull();
  });

  it("returns null for wrong role", () => {
    storeDeviceAuthToken(storePath, "device1", "node", "tok_abc");
    const entry = loadDeviceAuthToken(storePath, "device1", "operator");
    expect(entry).toBeNull();
  });

  it("clears a token", () => {
    storeDeviceAuthToken(storePath, "device1", "node", "tok_abc");
    clearDeviceAuthToken(storePath, "device1", "node");
    const entry = loadDeviceAuthToken(storePath, "device1", "node");
    expect(entry).toBeNull();
  });

  it("overwrites existing token for same role", () => {
    storeDeviceAuthToken(storePath, "device1", "node", "tok_old");
    storeDeviceAuthToken(storePath, "device1", "node", "tok_new");
    const entry = loadDeviceAuthToken(storePath, "device1", "node");
    expect(entry!.token).toBe("tok_new");
  });
});
