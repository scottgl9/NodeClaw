import type { DeviceIdentity } from "../crypto/index.js";
import type { EventFrame, HelloOk } from "../protocol/index.js";

export type GatewayClientOptions = {
  url: string;
  token?: string;
  deviceToken?: string;
  deviceIdentity?: DeviceIdentity;
  role?: string;
  scopes?: string[];
  caps?: string[];
  commands?: string[];
  permissions?: Record<string, boolean>;
  clientName?: string;
  clientDisplayName?: string;
  clientVersion?: string;
  platform?: string;
  deviceFamily?: string;
  mode?: string;
  instanceId?: string;
  pathEnv?: string;
  tlsVerify?: boolean;
  connectTimeoutMs?: number;
  requestTimeoutMs?: number;
  onEvent?: (evt: EventFrame) => void;
  onHelloOk?: (hello: HelloOk) => void;
  onConnectError?: (err: Error) => void;
  onClose?: (code: number, reason: string) => void;
};
