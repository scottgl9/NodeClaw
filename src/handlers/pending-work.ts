import type { GatewayClient } from "../client/index.js";
import type { NodePendingDrainResult } from "../protocol/index.js";

export async function drainPendingWork(
  client: GatewayClient,
  maxItems = 4,
): Promise<NodePendingDrainResult | null> {
  try {
    const result = await client.request<NodePendingDrainResult>(
      "node.pending.drain",
      { maxItems },
    );
    return result;
  } catch {
    return null;
  }
}

export async function ackPendingWork(
  client: GatewayClient,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  try {
    await client.request("node.pending.ack", { ids });
  } catch {
    // Best-effort ack
  }
}
