import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { GatewayClient } from "../client/index.js";
import type { NodeInvokeRequestPayload, NodeInvokeResultParams } from "../protocol/index.js";
import { resolveBaseDir } from "../config/index.js";

export type ExecAllowlistEntry = {
  id?: string;
  pattern: string;
  lastUsedAt?: number;
  lastUsedCommand?: string;
  lastResolvedPath?: string;
};

export type ExecApprovalsDefaults = {
  security?: string; // "deny" | "allowlist" | "full"
  ask?: string; // "off" | "on-miss" | "always"
  askFallback?: string;
  autoAllowSkills?: boolean;
};

export type ExecApprovalsAgent = ExecApprovalsDefaults & {
  allowlist?: ExecAllowlistEntry[];
};

export type ExecApprovalsFile = {
  version: 1;
  socket?: {
    path?: string;
    token?: string;
  };
  defaults?: ExecApprovalsDefaults;
  agents?: Record<string, ExecApprovalsAgent>;
};

export type ExecApprovalsSnapshot = {
  path: string;
  exists: boolean;
  raw: string | null;
  file: ExecApprovalsFile;
  hash: string;
};

function resolveExecApprovalsPath(env?: NodeJS.ProcessEnv): string {
  return path.join(resolveBaseDir(env), "exec-approvals.json");
}

function hashRaw(raw: string | null): string {
  return crypto
    .createHash("sha256")
    .update(raw ?? "")
    .digest("hex");
}

function loadExecApprovalsFile(filePath: string): ExecApprovalsSnapshot {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as ExecApprovalsFile;
      if (parsed?.version === 1) {
        return { path: filePath, exists: true, raw, file: parsed, hash: hashRaw(raw) };
      }
    }
  } catch {
    // fall through
  }
  const defaultFile: ExecApprovalsFile = { version: 1 };
  return { path: filePath, exists: false, raw: null, file: defaultFile, hash: hashRaw(null) };
}

function saveExecApprovalsFile(
  filePath: string,
  file: ExecApprovalsFile,
): ExecApprovalsSnapshot {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const raw = JSON.stringify(file, null, 2) + "\n";
  fs.writeFileSync(filePath, raw, { mode: 0o600 });
  return { path: filePath, exists: true, raw, file, hash: hashRaw(raw) };
}

export function createExecApprovalsGetHandler(env?: NodeJS.ProcessEnv) {
  return async (
    payload: NodeInvokeRequestPayload,
    client: GatewayClient,
  ): Promise<void> => {
    const filePath = resolveExecApprovalsPath(env);
    const snapshot = loadExecApprovalsFile(filePath);
    const result: NodeInvokeResultParams = {
      id: payload.id,
      nodeId: payload.nodeId,
      ok: true,
      payloadJSON: JSON.stringify(snapshot),
    };
    await client.request("node.invoke.result", result);
  };
}

export function createExecApprovalsSetHandler(env?: NodeJS.ProcessEnv) {
  return async (
    payload: NodeInvokeRequestPayload,
    client: GatewayClient,
  ): Promise<void> => {
    const filePath = resolveExecApprovalsPath(env);

    let params: { file?: ExecApprovalsFile; baseHash?: string | null } = {};
    if (payload.paramsJSON) {
      try {
        params = JSON.parse(payload.paramsJSON) as typeof params;
      } catch {
        await client.request("node.invoke.result", {
          id: payload.id,
          nodeId: payload.nodeId,
          ok: false,
          error: { code: "INVALID_PARAMS", message: "Invalid params" },
        } satisfies NodeInvokeResultParams);
        return;
      }
    }

    // CAS: check base hash if provided
    if (params.baseHash) {
      const current = loadExecApprovalsFile(filePath);
      if (current.hash !== params.baseHash) {
        await client.request("node.invoke.result", {
          id: payload.id,
          nodeId: payload.nodeId,
          ok: false,
          error: {
            code: "HASH_MISMATCH",
            message: "Exec approvals file was modified concurrently",
          },
        } satisfies NodeInvokeResultParams);
        return;
      }
    }

    const file = params.file ?? { version: 1 as const };
    const snapshot = saveExecApprovalsFile(filePath, file);
    const result: NodeInvokeResultParams = {
      id: payload.id,
      nodeId: payload.nodeId,
      ok: true,
      payloadJSON: JSON.stringify(snapshot),
    };
    await client.request("node.invoke.result", result);
  };
}
