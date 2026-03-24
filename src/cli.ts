#!/usr/bin/env node

import { Command } from "commander";
import { VERSION } from "./index.js";
import { registerPairCommand } from "./cli/pair.js";

const program = new Command();

program
  .name("nodeclaw")
  .description("Minimal OpenClaw node protocol client")
  .version(VERSION);

registerPairCommand(program);

program.parse();
