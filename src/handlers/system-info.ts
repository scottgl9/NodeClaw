import os from "node:os";
import fs from "node:fs";
import type { GatewayClient } from "../client/index.js";
import type { NodeInvokeRequestPayload, NodeInvokeResultParams } from "../protocol/index.js";

export type SystemInfo = {
  cpu: {
    model: string;
    cores: number;
  };
  memory: {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
  };
  disk?: {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
  };
  uptime: number;
  platform: string;
  arch: string;
  hostname: string;
  nodeVersion: string;
};

export function getSystemInfo(workdir?: string): SystemInfo {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  const info: SystemInfo = {
    cpu: {
      model: cpus.length > 0 ? cpus[0].model : "unknown",
      cores: cpus.length,
    },
    memory: {
      totalBytes: totalMem,
      freeBytes: freeMem,
      usedBytes: totalMem - freeMem,
    },
    uptime: os.uptime(),
    platform: process.platform,
    arch: process.arch,
    hostname: os.hostname(),
    nodeVersion: process.version,
  };

  // Disk info via statfs (Node 20+)
  const statfsPath = workdir || "/";
  try {
    const stats = fs.statfsSync(statfsPath);
    info.disk = {
      totalBytes: stats.blocks * stats.bsize,
      freeBytes: stats.bavail * stats.bsize,
      usedBytes: (stats.blocks - stats.bavail) * stats.bsize,
    };
  } catch {
    // Disk info unavailable
  }

  return info;
}

export async function systemInfoHandler(
  payload: NodeInvokeRequestPayload,
  client: GatewayClient,
  workdir?: string,
): Promise<void> {
  const info = getSystemInfo(workdir);
  const result: NodeInvokeResultParams = {
    id: payload.id,
    nodeId: payload.nodeId,
    ok: true,
    payloadJSON: JSON.stringify(info),
  };
  await client.request("node.invoke.result", result);
}
