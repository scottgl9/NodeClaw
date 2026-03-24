import os from "node:os";
import {
  loadOrCreateIdentity,
  loadDeviceAuthToken,
} from "../crypto/index.js";
import {
  loadConfig,
  resolveIdentityPath,
  resolveTokenStorePath,
  type NodeClawConfig,
} from "../config/index.js";
import { GatewayClient } from "../client/index.js";
import { coerceNodeInvokePayload, type EventFrame } from "../protocol/index.js";
import { VERSION } from "../index.js";
import { CommandRouter } from "./router.js";

export type NodeRuntimeOptions = {
  config?: NodeClawConfig;
  env?: NodeJS.ProcessEnv;
  router?: CommandRouter;
};

export async function startNode(opts: NodeRuntimeOptions = {}): Promise<{
  client: GatewayClient;
  router: CommandRouter;
  stop: () => void;
}> {
  const config = opts.config ?? loadConfig(opts.env);
  const identityPath = resolveIdentityPath(opts.env);
  const tokenStorePath = resolveTokenStorePath(opts.env);
  const identity = loadOrCreateIdentity(identityPath);
  const role = "node";

  const storedAuth = loadDeviceAuthToken(
    tokenStorePath,
    identity.deviceId,
    role,
  );
  if (!storedAuth) {
    throw new Error(
      "Not paired with a gateway. Run 'nodeclaw pair <gateway-url>' first.",
    );
  }

  const router = opts.router ?? new CommandRouter();

  const client = new GatewayClient({
    url: config.gateway.url,
    deviceIdentity: identity,
    deviceToken: storedAuth.token,
    role,
    scopes: ["node.invoke"],
    caps: ["system"],
    commands: ["system.run", "system.run.prepare", "system.which"],
    clientDisplayName: config.device.name || os.hostname(),
    clientVersion: VERSION,
    platform: process.platform,
    mode: "node",
    tlsVerify: config.gateway.tlsVerify,
    onHelloOk: (hello) => {
      console.log(
        `Connected to gateway (protocol ${hello.protocol ?? "?"}, connId: ${hello.server?.connId ?? "?"})`,
      );
    },
    onEvent: (evt: EventFrame) => {
      if (evt.event === "node.invoke.request") {
        const invokePayload = coerceNodeInvokePayload(evt.payload);
        if (invokePayload) {
          void router.dispatch(invokePayload, client).catch((err) => {
            console.error(
              `Handler error for ${invokePayload.command}: ${String(err)}`,
            );
          });
        }
      }
    },
    onConnectError: (err) => {
      console.error(`Connection error: ${err.message}`);
    },
    onClose: (code, reason) => {
      if (code !== 1000) {
        console.log(`Disconnected (${code}): ${reason || "unknown"}`);
      }
    },
  });

  client.start();

  return {
    client,
    router,
    stop: () => client.stop(),
  };
}
