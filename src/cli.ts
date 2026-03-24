#!/usr/bin/env node

import { Command } from "commander";
import { VERSION } from "./index.js";
import { registerPairCommand } from "./cli/pair.js";
import { registerStartCommand } from "./cli/start.js";
import { registerStatusCommand } from "./cli/status.js";
import { registerUnpairCommand } from "./cli/unpair.js";
import { registerVersionCommand } from "./cli/version.js";
import { registerDoctorCommand } from "./cli/doctor.js";
import { registerInstallServiceCommand } from "./cli/install-service.js";

const program = new Command();

program
  .name("nodeclaw")
  .description("Minimal OpenClaw node protocol client")
  .version(VERSION);

registerPairCommand(program);
registerStartCommand(program);
registerStatusCommand(program);
registerUnpairCommand(program);
registerVersionCommand(program);
registerDoctorCommand(program);
registerInstallServiceCommand(program);

program.parse();
