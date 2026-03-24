import { execFileSync } from "node:child_process";
import type { GatewayClient } from "../client/index.js";
import type { NodeInvokeRequestPayload, NodeInvokeResultParams } from "../protocol/index.js";

function whichBin(bin: string): string | null {
  try {
    const result = execFileSync("which", [bin], {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return result.trim() || null;
  } catch {
    return null;
  }
}

export function resolveWhich(bins: string[]): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const bin of bins) {
    result[bin] = whichBin(bin);
  }
  return result;
}

export async function systemWhichHandler(
  payload: NodeInvokeRequestPayload,
  client: GatewayClient,
): Promise<void> {
  let bins: string[] = [];
  if (payload.paramsJSON) {
    try {
      const parsed = JSON.parse(payload.paramsJSON) as { bins?: string[] };
      if (Array.isArray(parsed.bins)) {
        bins = parsed.bins.filter((b): b is string => typeof b === "string");
      }
    } catch {
      // ignore
    }
  }

  const resolved = resolveWhich(bins);
  const result: NodeInvokeResultParams = {
    id: payload.id,
    nodeId: payload.nodeId,
    ok: true,
    payloadJSON: JSON.stringify({ bins: resolved }),
  };
  await client.request("node.invoke.result", result);
}
