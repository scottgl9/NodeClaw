import type { Command } from "commander";
import { pairWithGateway } from "../pairing/index.js";

export function registerPairCommand(program: Command): void {
  program
    .command("pair")
    .description("Pair this device with an OpenClaw gateway")
    .argument("<gateway-url>", "WebSocket URL of the gateway (e.g. wss://host:18789)")
    .option("-n, --name <name>", "Display name for this device")
    .option("-t, --token <token>", "Gateway auth token (required when gateway has auth.mode=token)")
    .action(async (gatewayUrl: string, opts: { name?: string; token?: string }) => {
      try {
        const result = await pairWithGateway({
          gatewayUrl,
          deviceName: opts.name,
          gatewayToken: opts.token,
        });
        console.log(result.message);
        console.log(`Device ID: ${result.deviceId}`);
        process.exit(0);
      } catch (err) {
        console.error(`Pairing failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
