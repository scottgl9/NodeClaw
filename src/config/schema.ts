import { z } from "zod";

export const GatewayConfigSchema = z.object({
  url: z.string().url().default("ws://127.0.0.1:18789"),
  tlsVerify: z.boolean().default(true),
});

export const DeviceConfigSchema = z.object({
  name: z.string().default(""),
  workdir: z.string().default(""),
});

export const ExecConfigSchema = z.object({
  blockedCommands: z.array(z.string()).default([]),
  timeoutMs: z.number().int().min(0).default(60_000),
  maxConcurrent: z.number().int().min(1).default(3),
});

export const LogConfigSchema = z.object({
  level: z.enum(["debug", "info", "warn", "error"]).default("info"),
  path: z.string().optional(),
});

export const NodeClawConfigSchema = z.object({
  gateway: GatewayConfigSchema.default({}),
  device: DeviceConfigSchema.default({}),
  exec: ExecConfigSchema.default({}),
  log: LogConfigSchema.default({}),
});

export type NodeClawConfig = z.infer<typeof NodeClawConfigSchema>;
export type GatewayConfig = z.infer<typeof GatewayConfigSchema>;
export type DeviceConfig = z.infer<typeof DeviceConfigSchema>;
export type ExecConfig = z.infer<typeof ExecConfigSchema>;
export type LogConfig = z.infer<typeof LogConfigSchema>;
