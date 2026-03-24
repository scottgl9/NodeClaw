export const PROTOCOL_VERSION = 3;

export const CLIENT_NAME = "nodeclaw";

export const CLIENT_MODES = {
  NODE: "node",
  BACKEND: "backend",
  PROBE: "probe",
} as const;

export type ClientMode = (typeof CLIENT_MODES)[keyof typeof CLIENT_MODES];
