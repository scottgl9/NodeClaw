import type { GatewayClient } from "../client/index.js";
import type { NodeInvokeRequestPayload, NodeInvokeResultParams } from "../protocol/index.js";

export type InvokeHandler = (
  payload: NodeInvokeRequestPayload,
  client: GatewayClient,
) => Promise<void>;

export class CommandRouter {
  private handlers = new Map<string, InvokeHandler>();

  register(command: string, handler: InvokeHandler): void {
    this.handlers.set(command, handler);
  }

  async dispatch(
    payload: NodeInvokeRequestPayload,
    client: GatewayClient,
  ): Promise<void> {
    const handler = this.handlers.get(payload.command);
    if (handler) {
      await handler(payload, client);
      return;
    }

    // Unknown command — send error result
    const result: NodeInvokeResultParams = {
      id: payload.id,
      nodeId: payload.nodeId,
      ok: false,
      error: {
        code: "UNKNOWN_COMMAND",
        message: `Unknown command: ${payload.command}`,
      },
    };
    await client.request("node.invoke.result", result);
  }
}
