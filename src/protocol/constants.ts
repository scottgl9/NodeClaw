export const PROTOCOL_VERSION = 3;

// Must match the gateway's GATEWAY_CLIENT_IDS.NODE_HOST value.
export const CLIENT_NAME = "node-host";

export const CLIENT_MODES = {
  NODE: "node",
  BACKEND: "backend",
  PROBE: "probe",
} as const;

export type ClientMode = (typeof CLIENT_MODES)[keyof typeof CLIENT_MODES];
