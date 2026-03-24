import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { GatewayClient } from "../client/index.js";
import type { NodeInvokeRequestPayload, NodeInvokeResultParams } from "../protocol/index.js";
import type { ExecConfig } from "../config/index.js";
import { emitExecStarted, emitExecFinished, emitExecDenied } from "./node-events.js";

const OUTPUT_CAP = 200_000; // 200KB max output capture

type SystemRunParams = {
  command: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  sessionKey?: string;
  runId?: string;
  suppressNotifyOnExit?: boolean;
};

type RunResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  truncated: boolean;
};

let activeCount = 0;

function parseRunParams(paramsJSON?: string | null): SystemRunParams | null {
  if (!paramsJSON) {
    return null;
  }
  try {
    const parsed = JSON.parse(paramsJSON) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const obj = parsed as Record<string, unknown>;
    let command: string[] | null = null;
    if (Array.isArray(obj.command)) {
      command = (obj.command as string[]).filter((s) => typeof s === "string");
    } else if (typeof obj.command === "string" && obj.command.trim()) {
      command = [obj.command];
    } else if (typeof obj.rawCommand === "string" && obj.rawCommand.trim()) {
      command = ["sh", "-c", obj.rawCommand as string];
    }
    if (!command || command.length === 0) {
      return null;
    }
    return {
      command,
      cwd: typeof obj.cwd === "string" ? obj.cwd : undefined,
      env:
        typeof obj.env === "object" && obj.env !== null
          ? (obj.env as Record<string, string>)
          : undefined,
      timeoutMs:
        typeof obj.timeoutMs === "number" ? obj.timeoutMs : undefined,
      sessionKey:
        typeof obj.sessionKey === "string" ? obj.sessionKey : undefined,
      runId: typeof obj.runId === "string" ? obj.runId : undefined,
      suppressNotifyOnExit:
        typeof obj.suppressNotifyOnExit === "boolean"
          ? obj.suppressNotifyOnExit
          : undefined,
    };
  } catch {
    return null;
  }
}

function isPathWithinWorkdir(testPath: string, workdir: string): boolean {
  if (!workdir) {
    return true; // no workdir restriction
  }
  const resolved = path.resolve(testPath);
  const resolvedWorkdir = path.resolve(workdir);
  return resolved === resolvedWorkdir || resolved.startsWith(resolvedWorkdir + path.sep);
}

function isBlockedCommand(
  command: string[],
  blockedCommands: string[],
): boolean {
  if (blockedCommands.length === 0) {
    return false;
  }
  const cmdStr = command.join(" ");
  return blockedCommands.some(
    (blocked) => cmdStr === blocked || cmdStr.startsWith(blocked + " "),
  );
}

function runCommand(
  params: SystemRunParams,
  execConfig: ExecConfig,
): Promise<RunResult> {
  return new Promise<RunResult>((resolve) => {
    const timeoutMs = params.timeoutMs ?? execConfig.timeoutMs;
    const [bin, ...args] = params.command;
    const cwd = params.cwd || undefined;
    const env = params.env
      ? { ...process.env, ...params.env }
      : undefined;

    const proc = spawn(bin, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let truncated = false;
    let timedOut = false;
    let totalOutput = 0;

    const appendOutput = (
      target: "stdout" | "stderr",
      chunk: Buffer,
    ): void => {
      const remaining = OUTPUT_CAP - totalOutput;
      if (remaining <= 0) {
        truncated = true;
        return;
      }
      const text = chunk.toString("utf8");
      const toAppend = text.length > remaining ? text.slice(0, remaining) : text;
      totalOutput += toAppend.length;
      if (target === "stdout") {
        stdout += toAppend;
      } else {
        stderr += toAppend;
      }
      if (totalOutput >= OUTPUT_CAP) {
        truncated = true;
      }
    };

    proc.stdout.on("data", (chunk: Buffer) => appendOutput("stdout", chunk));
    proc.stderr.on("data", (chunk: Buffer) => appendOutput("stderr", chunk));

    let timeoutTimer: NodeJS.Timeout | null = null;
    if (timeoutMs > 0) {
      timeoutTimer = setTimeout(() => {
        timedOut = true;
        try {
          proc.kill("SIGKILL");
        } catch {
          // ignore
        }
      }, timeoutMs);
    }

    proc.on("close", (code) => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
      }
      resolve({
        exitCode: code,
        stdout,
        stderr,
        timedOut,
        truncated,
      });
    });

    proc.on("error", (err) => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
      }
      resolve({
        exitCode: null,
        stdout,
        stderr: stderr + (stderr ? "\n" : "") + err.message,
        timedOut: false,
        truncated,
      });
    });
  });
}

export function createSystemRunHandler(execConfig: ExecConfig, workdir: string) {
  return async (
    payload: NodeInvokeRequestPayload,
    client: GatewayClient,
  ): Promise<void> => {
    const sendResult = async (result: NodeInvokeResultParams) => {
      await client.request("node.invoke.result", result);
    };

    const params = parseRunParams(payload.paramsJSON);
    if (!params) {
      await sendResult({
        id: payload.id,
        nodeId: payload.nodeId,
        ok: false,
        error: { code: "INVALID_PARAMS", message: "Invalid system.run params" },
      });
      return;
    }

    const commandText = params.command.join(" ");
    const sessionKey = params.sessionKey ?? "";
    const runId = params.runId ?? randomUUID();
    const suppressNotifyOnExit = params.suppressNotifyOnExit;

    // Security: check blocked commands
    if (isBlockedCommand(params.command, execConfig.blockedCommands)) {
      void emitExecDenied(client, {
        sessionKey,
        runId,
        command: commandText,
        reason: "allowlist-miss",
        suppressNotifyOnExit,
      });
      await sendResult({
        id: payload.id,
        nodeId: payload.nodeId,
        ok: false,
        error: { code: "BLOCKED", message: "Command is blocked by policy" },
      });
      return;
    }

    // Security: validate cwd is within workdir
    if (params.cwd && !isPathWithinWorkdir(params.cwd, workdir)) {
      void emitExecDenied(client, {
        sessionKey,
        runId,
        command: commandText,
        reason: "security=deny",
        suppressNotifyOnExit,
      });
      await sendResult({
        id: payload.id,
        nodeId: payload.nodeId,
        ok: false,
        error: {
          code: "WORKDIR_VIOLATION",
          message: `Working directory ${params.cwd} is outside allowed workdir ${workdir}`,
        },
      });
      return;
    }

    // Check concurrent limit
    if (activeCount >= execConfig.maxConcurrent) {
      await sendResult({
        id: payload.id,
        nodeId: payload.nodeId,
        ok: false,
        error: {
          code: "RESOURCE_EXHAUSTED",
          message: `Max concurrent executions (${execConfig.maxConcurrent}) reached`,
        },
      });
      return;
    }

    activeCount++;
    void emitExecStarted(client, {
      sessionKey,
      runId,
      command: commandText,
      suppressNotifyOnExit,
    });
    try {
      const result = await runCommand(params, execConfig);
      void emitExecFinished(client, {
        sessionKey,
        runId,
        command: commandText,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        success: result.exitCode === 0 && !result.timedOut,
        output: result.stdout + result.stderr,
        suppressNotifyOnExit,
      });
      await sendResult({
        id: payload.id,
        nodeId: payload.nodeId,
        ok: true,
        payloadJSON: JSON.stringify({
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
          timedOut: result.timedOut,
          truncated: result.truncated,
        }),
      });
    } catch (err) {
      await sendResult({
        id: payload.id,
        nodeId: payload.nodeId,
        ok: false,
        error: {
          code: "EXEC_ERROR",
          message: err instanceof Error ? err.message : String(err),
        },
      });
    } finally {
      activeCount--;
    }
  };
}

// For testing
export { parseRunParams, isPathWithinWorkdir, isBlockedCommand, runCommand };
export type { SystemRunParams, RunResult };
