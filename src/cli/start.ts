import type { Command } from "commander";
import { startNode } from "../runtime/index.js";
import { registerAllHandlers } from "../handlers/index.js";

export function registerStartCommand(program: Command): void {
  program
    .command("start")
    .description("Start the node daemon (foreground)")
    .action(async () => {
      try {
        const { router, stop } = await startNode();
        registerAllHandlers(router);

        console.log("NodeClaw running. Press Ctrl+C to stop.");

        const shutdown = () => {
          console.log("\nShutting down...");
          stop();
          process.exit(0);
        };
        process.on("SIGINT", shutdown);
        process.on("SIGTERM", shutdown);

        // Keep process alive
        await new Promise(() => {});
      } catch (err) {
        console.error(
          err instanceof Error ? err.message : String(err),
        );
        process.exit(1);
      }
    });
}
