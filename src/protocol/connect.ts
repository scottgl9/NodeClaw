export type ConnectClientInfo = {
  id: string;
  displayName?: string;
  version?: string;
  platform?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  mode?: string;
  instanceId?: string;
};

export type ConnectDeviceInfo = {
  id: string;
  publicKey: string;
  signature: string;
  signedAt: number;
  nonce: string;
};

export type ConnectAuth = {
  token?: string;
  bootstrapToken?: string;
  deviceToken?: string;
  password?: string;
};

export type ConnectParams = {
  minProtocol: number;
  maxProtocol: number;
  client: ConnectClientInfo;
  caps?: string[];
  commands?: string[];
  permissions?: Record<string, boolean>;
  pathEnv?: string;
  auth?: ConnectAuth;
  role?: string;
  scopes?: string[];
  device?: ConnectDeviceInfo;
};

export type HelloOkAuth = {
  deviceToken?: string;
  role?: string;
  scopes?: string[];
  issuedAtMs?: number;
};

export type HelloOkPolicy = {
  maxPayload?: number;
  maxBufferedBytes?: number;
  tickIntervalMs?: number;
};

export type HelloOk = {
  type?: string;
  protocol?: number;
  server?: {
    version?: string;
    connId?: string;
  };
  features?: {
    methods?: string[];
    events?: string[];
  };
  policy?: HelloOkPolicy;
  auth?: HelloOkAuth;
};
