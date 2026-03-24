import type { EventFrame, ResponseFrame, RequestFrame } from "./frames.js";
import type { NodeInvokeRequestPayload } from "./nodes.js";

export function isEventFrame(msg: unknown): msg is EventFrame {
  return (
    typeof msg === "object" &&
    msg !== null &&
    (msg as Record<string, unknown>).type === "event" &&
    typeof (msg as Record<string, unknown>).event === "string"
  );
}

export function isResponseFrame(msg: unknown): msg is ResponseFrame {
  return (
    typeof msg === "object" &&
    msg !== null &&
    (msg as Record<string, unknown>).type === "res" &&
    typeof (msg as Record<string, unknown>).id === "string" &&
    typeof (msg as Record<string, unknown>).ok === "boolean"
  );
}

export function isRequestFrame(msg: unknown): msg is RequestFrame {
  return (
    typeof msg === "object" &&
    msg !== null &&
    (msg as Record<string, unknown>).type === "req" &&
    typeof (msg as Record<string, unknown>).id === "string" &&
    typeof (msg as Record<string, unknown>).method === "string"
  );
}

export function coerceNodeInvokePayload(
  payload: unknown,
): NodeInvokeRequestPayload | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const obj = payload as Record<string, unknown>;
  if (typeof obj.id !== "string" || typeof obj.command !== "string") {
    return null;
  }
  return {
    id: obj.id,
    nodeId: typeof obj.nodeId === "string" ? obj.nodeId : "",
    command: obj.command,
    paramsJSON:
      typeof obj.paramsJSON === "string" ? obj.paramsJSON : undefined,
    timeoutMs:
      typeof obj.timeoutMs === "number" ? obj.timeoutMs : undefined,
    idempotencyKey:
      typeof obj.idempotencyKey === "string"
        ? obj.idempotencyKey
        : undefined,
  };
}
