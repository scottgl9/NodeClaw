#!/usr/bin/env node

import { Command } from "commander";
import { VERSION } from "./index.js";

const program = new Command();

program
  .name("nodeclaw")
  .description("Minimal OpenClaw node protocol client")
  .version(VERSION);

program.parse();
