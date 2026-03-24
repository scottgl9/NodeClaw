export type DeviceAuthPayloadV3Params = {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string | null;
  nonce: string;
  platform?: string | null;
  deviceFamily?: string | null;
};

function normalizeMetadataForAuth(value?: string | null): string {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  // ASCII-lowercase only (matches OpenClaw's cross-runtime normalization)
  return trimmed.replace(/[A-Z]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) + 32),
  );
}

export function buildDeviceAuthPayloadV3(
  params: DeviceAuthPayloadV3Params,
): string {
  const scopes = params.scopes.join(",");
  const token = params.token ?? "";
  const platform = normalizeMetadataForAuth(params.platform);
  const deviceFamily = normalizeMetadataForAuth(params.deviceFamily);
  return [
    "v3",
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
    params.nonce,
    platform,
    deviceFamily,
  ].join("|");
}
