import os from "node:os";
import {
  loadOrCreateIdentity,
  storeDeviceAuthToken,
  loadDeviceAuthToken,
} from "../crypto/index.js";
import { resolveIdentityPath, resolveTokenStorePath } from "../config/index.js";
import { GatewayClient } from "../client/index.js";
import { VERSION } from "../index.js";
import type { HelloOk, NodePairRequestParams } from "../protocol/index.js";

export type PairOptions = {
  gatewayUrl: string;
  deviceName?: string;
  env?: NodeJS.ProcessEnv;
};

export type PairResult = {
  deviceId: string;
  paired: boolean;
  message: string;
};

export async function pairWithGateway(opts: PairOptions): Promise<PairResult> {
  const identityPath = resolveIdentityPath(opts.env);
  const tokenStorePath = resolveTokenStorePath(opts.env);
  const identity = loadOrCreateIdentity(identityPath);
  const role = "node";

  // Check if already paired
  const existingToken = loadDeviceAuthToken(tokenStorePath, identity.deviceId, role);
  if (existingToken) {
    return {
      deviceId: identity.deviceId,
      paired: true,
      message: "Already paired with gateway.",
    };
  }

  return new Promise<PairResult>((resolve, reject) => {
    let pairRequestSent = false;
    let timeoutTimer: NodeJS.Timeout | null = null;

    const client = new GatewayClient({
      url: opts.gatewayUrl,
      deviceIdentity: identity,
      role,
      scopes: ["node.invoke"],
      caps: ["system"],
      commands: ["system.run", "system.run.prepare", "system.which"],
      clientDisplayName: opts.deviceName || os.hostname(),
      platform: process.platform,
      mode: "node",
      onHelloOk: (hello: HelloOk) => {
        // Connected successfully — if we get a deviceToken, pairing is done
        if (hello.auth?.deviceToken) {
          storeDeviceAuthToken(
            tokenStorePath,
            identity.deviceId,
            role,
            hello.auth.deviceToken,
            hello.auth.scopes,
          );
          cleanup();
          resolve({
            deviceId: identity.deviceId,
            paired: true,
            message: "Paired successfully!",
          });
          return;
        }

        // No device token — send pair request
        if (!pairRequestSent) {
          pairRequestSent = true;
          const params: NodePairRequestParams = {
            nodeId: identity.deviceId,
            displayName: opts.deviceName || os.hostname(),
            platform: process.platform,
            version: VERSION,
            caps: ["system"],
            commands: ["system.run", "system.run.prepare", "system.which"],
          };
          void client
            .request("node.pair.request", params)
            .then(() => {
              console.log(
                'Pairing request sent. Waiting for approval on the gateway...\n' +
                `Run "openclaw nodes approve" on your gateway to approve this device.`,
              );
            })
            .catch((err) => {
              cleanup();
              reject(new Error(`Pair request failed: ${String(err)}`));
            });
        }
      },
      onConnectError: (err) => {
        // If it's a pairing-required error, that's expected during pairing flow
        if (!pairRequestSent) {
          // Will reconnect and try again
        }
      },
      onClose: () => {
        // reconnect will be handled by the client
      },
    });

    const cleanup = () => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
      client.stop();
    };

    // Timeout after 5 minutes
    timeoutTimer = setTimeout(() => {
      cleanup();
      reject(new Error("Pairing timed out after 5 minutes. Try again."));
    }, 5 * 60 * 1000);

    client.start();
  });
}
