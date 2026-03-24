export type NodeInvokeRequestPayload = {
  id: string;
  nodeId: string;
  command: string;
  paramsJSON?: string | null;
  timeoutMs?: number;
  idempotencyKey?: string;
};

export type NodeInvokeResultParams = {
  id: string;
  nodeId: string;
  ok: boolean;
  payload?: unknown;
  payloadJSON?: string | null;
  error?: {
    code?: string;
    message?: string;
  } | null;
};

export type NodeEventParams = {
  event: string;
  payload?: unknown;
  payloadJSON?: string | null;
};

export type NodePairRequestParams = {
  nodeId: string;
  displayName?: string;
  platform?: string;
  version?: string;
  coreVersion?: string;
  uiVersion?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  caps?: string[];
  commands?: string[];
  remoteIp?: string;
  silent?: boolean;
};

export type NodePendingDrainItem = {
  id: string;
  type: string;
  priority: string;
  createdAtMs: number;
  expiresAtMs?: number | null;
  payload?: Record<string, unknown>;
};

export type NodePendingDrainResult = {
  nodeId: string;
  revision: number;
  items: NodePendingDrainItem[];
  hasMore: boolean;
};

export type NodePendingAckParams = {
  ids: string[];
};
