import type { Command } from "commander";
import { VERSION, PROTOCOL_VERSION } from "../index.js";

export function registerVersionCommand(program: Command): void {
  program
    .command("info")
    .description("Show version and protocol information")
    .action(() => {
      console.log(`NodeClaw v${VERSION}`);
      console.log(`Protocol:     ${PROTOCOL_VERSION}`);
      console.log(`Node.js:      ${process.version}`);
      console.log(`Platform:     ${process.platform}`);
      console.log(`Arch:         ${process.arch}`);
    });
}
