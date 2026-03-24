import type { GatewayClient } from "../client/index.js";
import type { NodeEventParams } from "../protocol/index.js";

const EVENT_OUTPUT_MAX = 20_000; // 20KB tail for event output

function tailOutput(output: string, max: number): string {
  if (output.length <= max) return output;
  return output.slice(-max);
}

export async function emitNodeEvent(
  client: GatewayClient,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const params: NodeEventParams = {
    event,
    payloadJSON: JSON.stringify(payload),
  };
  try {
    await client.request("node.event", params);
  } catch {
    // Best-effort event emission
  }
}

export async function emitExecStarted(
  client: GatewayClient,
  opts: {
    sessionKey: string;
    runId: string;
    command?: string;
    suppressNotifyOnExit?: boolean;
  },
): Promise<void> {
  await emitNodeEvent(client, "exec.started", {
    sessionKey: opts.sessionKey,
    runId: opts.runId,
    host: "node",
    command: opts.command,
    suppressNotifyOnExit: opts.suppressNotifyOnExit,
  });
}

export async function emitExecFinished(
  client: GatewayClient,
  opts: {
    sessionKey: string;
    runId: string;
    command?: string;
    exitCode?: number | null;
    timedOut?: boolean;
    success?: boolean;
    output?: string;
    suppressNotifyOnExit?: boolean;
  },
): Promise<void> {
  await emitNodeEvent(client, "exec.finished", {
    sessionKey: opts.sessionKey,
    runId: opts.runId,
    host: "node",
    command: opts.command,
    exitCode: opts.exitCode,
    timedOut: opts.timedOut,
    success: opts.success,
    output: opts.output ? tailOutput(opts.output, EVENT_OUTPUT_MAX) : undefined,
    suppressNotifyOnExit: opts.suppressNotifyOnExit,
  });
}

export async function emitExecDenied(
  client: GatewayClient,
  opts: {
    sessionKey: string;
    runId: string;
    command?: string;
    reason: string;
    suppressNotifyOnExit?: boolean;
  },
): Promise<void> {
  await emitNodeEvent(client, "exec.denied", {
    sessionKey: opts.sessionKey,
    runId: opts.runId,
    host: "node",
    command: opts.command,
    reason: opts.reason,
    suppressNotifyOnExit: opts.suppressNotifyOnExit,
  });
}
