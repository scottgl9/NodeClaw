import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  generateIdentity,
  loadOrCreateIdentity,
  signDevicePayload,
  verifyDeviceSignature,
  publicKeyRawBase64Url,
  deriveDeviceId,
} from "./identity.js";

describe("crypto/identity", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nodeclaw-crypto-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("generates a valid identity", () => {
    const id = generateIdentity();
    expect(id.deviceId).toMatch(/^[0-9a-f]{64}$/);
    expect(id.publicKeyPem).toContain("BEGIN PUBLIC KEY");
    expect(id.privateKeyPem).toContain("BEGIN PRIVATE KEY");
  });

  it("deriveDeviceId matches generated deviceId", () => {
    const id = generateIdentity();
    expect(deriveDeviceId(id.publicKeyPem)).toBe(id.deviceId);
  });

  it("publicKeyRawBase64Url returns 32 bytes encoded", () => {
    const id = generateIdentity();
    const raw = publicKeyRawBase64Url(id.publicKeyPem);
    expect(raw).toBeTruthy();
    // Ed25519 public key is 32 bytes = 43 base64url chars (no padding)
    expect(raw.length).toBe(43);
  });

  it("sign and verify round-trip", () => {
    const id = generateIdentity();
    const payload = "test-payload-data";
    const sig = signDevicePayload(id.privateKeyPem, payload);
    expect(verifyDeviceSignature(id.publicKeyPem, payload, sig)).toBe(true);
  });

  it("verify fails with wrong payload", () => {
    const id = generateIdentity();
    const sig = signDevicePayload(id.privateKeyPem, "original");
    expect(verifyDeviceSignature(id.publicKeyPem, "tampered", sig)).toBe(false);
  });

  it("loadOrCreateIdentity creates new file when missing", () => {
    const filePath = path.join(tmpDir, "identity", "device.json");
    const id = loadOrCreateIdentity(filePath);
    expect(id.deviceId).toMatch(/^[0-9a-f]{64}$/);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("loadOrCreateIdentity reloads existing identity", () => {
    const filePath = path.join(tmpDir, "identity", "device.json");
    const id1 = loadOrCreateIdentity(filePath);
    const id2 = loadOrCreateIdentity(filePath);
    expect(id2.deviceId).toBe(id1.deviceId);
    expect(id2.publicKeyPem).toBe(id1.publicKeyPem);
  });

  it("loadOrCreateIdentity regenerates on corrupt file", () => {
    const filePath = path.join(tmpDir, "identity", "device.json");
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "corrupted");
    const id = loadOrCreateIdentity(filePath);
    expect(id.deviceId).toMatch(/^[0-9a-f]{64}$/);
  });
});
