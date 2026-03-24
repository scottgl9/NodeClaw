import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs";
import type { GatewayClient } from "../client/index.js";
import type { NodeInvokeRequestPayload, NodeInvokeResultParams } from "../protocol/index.js";

export type SystemRunApprovalPlan = {
  argv: string[];
  cwd: string | null;
  commandText: string;
  commandPreview?: string | null;
  agentId: string | null;
  sessionKey: string | null;
  mutableFileOperand?: {
    argvIndex: number;
    path: string;
    sha256: string;
  } | null;
};

type PrepareParams = {
  command?: unknown;
  rawCommand?: unknown;
  cwd?: unknown;
  agentId?: unknown;
  sessionKey?: unknown;
};

function resolveCommandArgv(params: PrepareParams): string[] | null {
  if (Array.isArray(params.command)) {
    const argv = params.command.filter(
      (s): s is string => typeof s === "string",
    );
    return argv.length > 0 ? argv : null;
  }
  if (typeof params.command === "string" && params.command.trim()) {
    return [params.command.trim()];
  }
  if (typeof params.rawCommand === "string" && params.rawCommand.trim()) {
    return ["sh", "-c", params.rawCommand.trim()];
  }
  return null;
}

function resolveMutableFileOperand(
  argv: string[],
): SystemRunApprovalPlan["mutableFileOperand"] {
  // Check if any argv element past index 0 is an existing file
  // This is a simplified version of OpenClaw's mutable file operand detection
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("-")) continue;
    try {
      const resolved = path.resolve(arg);
      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        const content = fs.readFileSync(resolved);
        const sha256 = crypto
          .createHash("sha256")
          .update(content)
          .digest("hex");
        return { argvIndex: i, path: resolved, sha256 };
      }
    } catch {
      // skip
    }
  }
  return null;
}

export async function systemRunPrepareHandler(
  payload: NodeInvokeRequestPayload,
  client: GatewayClient,
): Promise<void> {
  let params: PrepareParams = {};
  if (payload.paramsJSON) {
    try {
      params = JSON.parse(payload.paramsJSON) as PrepareParams;
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

  const argv = resolveCommandArgv(params);
  if (!argv) {
    await client.request("node.invoke.result", {
      id: payload.id,
      nodeId: payload.nodeId,
      ok: false,
      error: { code: "INVALID_PARAMS", message: "No command provided" },
    } satisfies NodeInvokeResultParams);
    return;
  }

  const cwd =
    typeof params.cwd === "string" && params.cwd.trim()
      ? path.resolve(params.cwd.trim())
      : null;
  const agentId =
    typeof params.agentId === "string" ? params.agentId : null;
  const sessionKey =
    typeof params.sessionKey === "string" ? params.sessionKey : null;

  const plan: SystemRunApprovalPlan = {
    argv,
    cwd,
    commandText: argv.join(" "),
    commandPreview: argv.length > 3 ? argv.slice(0, 3).join(" ") + "..." : null,
    agentId,
    sessionKey,
    mutableFileOperand: resolveMutableFileOperand(argv),
  };

  const result: NodeInvokeResultParams = {
    id: payload.id,
    nodeId: payload.nodeId,
    ok: true,
    payloadJSON: JSON.stringify({ plan }),
  };
  await client.request("node.invoke.result", result);
}
