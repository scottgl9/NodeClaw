import fs from "node:fs";
import path from "node:path";

export type DeviceAuthEntry = {
  token: string;
  scopes: string[];
  issuedAtMs: number;
};

type DeviceAuthStore = {
  version: 1;
  deviceId: string;
  tokens: Record<string, DeviceAuthEntry>;
};

function readStore(filePath: string): DeviceAuthStore | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as DeviceAuthStore;
    if (
      parsed?.version !== 1 ||
      typeof parsed.deviceId !== "string" ||
      !parsed.tokens ||
      typeof parsed.tokens !== "object"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStore(filePath: string, store: DeviceAuthStore): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(store, null, 2)}\n`, {
    mode: 0o600,
  });
}

export function loadDeviceAuthToken(
  filePath: string,
  deviceId: string,
  role: string,
): DeviceAuthEntry | null {
  const store = readStore(filePath);
  if (!store || store.deviceId !== deviceId) {
    return null;
  }
  const entry = store.tokens[role];
  if (!entry || typeof entry.token !== "string") {
    return null;
  }
  return entry;
}

export function storeDeviceAuthToken(
  filePath: string,
  deviceId: string,
  role: string,
  token: string,
  scopes: string[] = [],
): DeviceAuthEntry {
  let store = readStore(filePath);
  if (!store || store.deviceId !== deviceId) {
    store = { version: 1, deviceId, tokens: {} };
  }
  const entry: DeviceAuthEntry = {
    token,
    scopes,
    issuedAtMs: Date.now(),
  };
  store.tokens[role] = entry;
  writeStore(filePath, store);
  return entry;
}

export function clearDeviceAuthToken(
  filePath: string,
  deviceId: string,
  role: string,
): void {
  const store = readStore(filePath);
  if (!store || store.deviceId !== deviceId) {
    return;
  }
  delete store.tokens[role];
  writeStore(filePath, store);
}
