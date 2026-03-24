import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import {
  signDevicePayload,
  publicKeyRawBase64Url,
  buildDeviceAuthPayloadV3,
} from "../crypto/index.js";
import {
  PROTOCOL_VERSION,
  CLIENT_NAME,
  CLIENT_MODES,
  isEventFrame,
  isResponseFrame,
  type ConnectParams,
  type HelloOk,
  type EventFrame,
} from "../protocol/index.js";
import { VERSION } from "../index.js";
import type { GatewayClientOptions } from "./types.js";

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
  timeout: NodeJS.Timeout | null;
};

const DEFAULT_CONNECT_TIMEOUT_MS = 2_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const MAX_BACKOFF_MS = 30_000;
const FORCE_STOP_GRACE_MS = 250;

export type ConnectionHealth = {
  connected: boolean;
  connectedAtMs: number | null;
  lastTickMs: number | null;
  reconnectCount: number;
  tickIntervalMs: number;
};

export class GatewayClient {
  private ws: WebSocket | null = null;
  private opts: GatewayClientOptions;
  private pending = new Map<string, Pending>();
  private backoffMs = 1000;
  private closed = false;
  private connectNonce: string | null = null;
  private connectSent = false;
  private connectTimer: NodeJS.Timeout | null = null;
  private lastTick: number | null = null;
  private tickIntervalMs = 30_000;
  private tickTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly requestTimeoutMs: number;
  private connectedAtMs: number | null = null;
  private reconnectCount = 0;

  constructor(opts: GatewayClientOptions) {
    this.opts = opts;
    this.requestTimeoutMs =
      typeof opts.requestTimeoutMs === "number"
        ? Math.max(1, opts.requestTimeoutMs)
        : DEFAULT_REQUEST_TIMEOUT_MS;
  }

  start(): void {
    if (this.closed) {
      return;
    }
    const url = this.opts.url;

    const ws = new WebSocket(url, {
      maxPayload: 25 * 1024 * 1024,
      rejectUnauthorized: this.opts.tlsVerify !== false,
    });
    this.ws = ws;

    ws.on("open", () => {
      this.queueConnect();
    });
    ws.on("message", (data) => {
      const raw =
        typeof data === "string"
          ? data
          : Buffer.isBuffer(data)
            ? data.toString("utf8")
            : Buffer.from(data as ArrayBuffer).toString("utf8");
      this.handleMessage(raw);
    });
    ws.on("close", (code, reason) => {
      const reasonText =
        typeof reason === "string"
          ? reason
          : Buffer.isBuffer(reason)
            ? reason.toString("utf8")
            : "";
      if (this.ws === ws) {
        this.ws = null;
      }
      this.flushPendingErrors(
        new Error(`gateway closed (${code}): ${reasonText}`),
      );
      this.scheduleReconnect();
      this.opts.onClose?.(code, reasonText);
    });
    ws.on("error", (err) => {
      if (!this.connectSent) {
        this.opts.onConnectError?.(
          err instanceof Error ? err : new Error(String(err)),
        );
      }
    });
  }

  stop(): void {
    this.closed = true;
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.close();
      setTimeout(() => {
        try {
          ws.terminate();
        } catch {
          // ignore
        }
      }, FORCE_STOP_GRACE_MS).unref();
    }
    this.flushPendingErrors(new Error("gateway client stopped"));
  }

  async stopAndWait(timeoutMs = 1000): Promise<void> {
    this.stop();
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, Math.min(timeoutMs, FORCE_STOP_GRACE_MS + 100));
      timer.unref();
    });
  }

  async request<T = unknown>(
    method: string,
    params?: unknown,
    opts?: { timeoutMs?: number },
  ): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("gateway not connected");
    }
    const id = randomUUID();
    const frame = { type: "req" as const, id, method, params };
    this.ws.send(JSON.stringify(frame));

    const timeoutMs = opts?.timeoutMs ?? this.requestTimeoutMs;
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`request ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });
    });
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN && this.connectSent;
  }

  getHealth(): ConnectionHealth {
    return {
      connected: this.isConnected(),
      connectedAtMs: this.connectedAtMs,
      lastTickMs: this.lastTick,
      reconnectCount: this.reconnectCount,
      tickIntervalMs: this.tickIntervalMs,
    };
  }

  private queueConnect(): void {
    this.connectNonce = null;
    this.connectSent = false;
    const connectTimeoutMs = this.opts.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
    }
    this.connectTimer = setTimeout(() => {
      if (this.connectSent || this.ws?.readyState !== WebSocket.OPEN) {
        return;
      }
      this.opts.onConnectError?.(new Error("gateway connect challenge timeout"));
      this.ws?.close(1008, "connect challenge timeout");
    }, connectTimeoutMs);
  }

  private sendConnect(): void {
    if (this.connectSent) {
      return;
    }
    const nonce = this.connectNonce?.trim() ?? "";
    if (!nonce) {
      this.opts.onConnectError?.(new Error("gateway connect challenge missing nonce"));
      this.ws?.close(1008, "connect challenge missing nonce");
      return;
    }
    this.connectSent = true;
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    const role = this.opts.role ?? "node";
    const scopes = this.opts.scopes ?? ["node.invoke"];
    const platform = this.opts.platform ?? process.platform;
    const signedAtMs = Date.now();

    // Build device auth
    const device = (() => {
      if (!this.opts.deviceIdentity) {
        return undefined;
      }
      const payload = buildDeviceAuthPayloadV3({
        deviceId: this.opts.deviceIdentity.deviceId,
        clientId: this.opts.clientName ?? CLIENT_NAME,
        clientMode: this.opts.mode ?? CLIENT_MODES.NODE,
        role,
        scopes,
        signedAtMs,
        token: this.opts.token ?? this.opts.deviceToken ?? null,
        nonce,
        platform,
        deviceFamily: this.opts.deviceFamily,
      });
      const signature = signDevicePayload(
        this.opts.deviceIdentity.privateKeyPem,
        payload,
      );
      return {
        id: this.opts.deviceIdentity.deviceId,
        publicKey: publicKeyRawBase64Url(this.opts.deviceIdentity.publicKeyPem),
        signature,
        signedAt: signedAtMs,
        nonce,
      };
    })();

    const auth =
      this.opts.token || this.opts.deviceToken
        ? {
            token: this.opts.token,
            deviceToken: this.opts.deviceToken,
          }
        : undefined;

    const params: ConnectParams = {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      client: {
        id: this.opts.clientName ?? CLIENT_NAME,
        displayName: this.opts.clientDisplayName,
        version: this.opts.clientVersion ?? VERSION,
        platform,
        deviceFamily: this.opts.deviceFamily,
        mode: this.opts.mode ?? CLIENT_MODES.NODE,
        instanceId: this.opts.instanceId,
      },
      caps: this.opts.caps ?? [],
      commands: this.opts.commands,
      permissions: this.opts.permissions,
      pathEnv: this.opts.pathEnv,
      auth,
      role,
      scopes,
      device,
    };

    void this.request<HelloOk>("connect", params)
      .then((helloOk) => {
        this.backoffMs = 1000;
        this.connectedAtMs = Date.now();
        this.tickIntervalMs =
          typeof helloOk.policy?.tickIntervalMs === "number"
            ? helloOk.policy.tickIntervalMs
            : 30_000;
        this.lastTick = Date.now();
        this.startTickWatch();
        this.opts.onHelloOk?.(helloOk);
      })
      .catch((err) => {
        this.opts.onConnectError?.(
          err instanceof Error ? err : new Error(String(err)),
        );
        this.ws?.close(1008, "connect failed");
      });
  }

  private handleMessage(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    if (isEventFrame(parsed)) {
      this.lastTick = Date.now();
      if (parsed.event === "connect.challenge") {
        const payload = parsed.payload as { nonce?: unknown } | undefined;
        const nonce =
          payload && typeof payload.nonce === "string" ? payload.nonce : null;
        if (!nonce || nonce.trim().length === 0) {
          this.opts.onConnectError?.(
            new Error("gateway connect challenge missing nonce"),
          );
          this.ws?.close(1008, "connect challenge missing nonce");
          return;
        }
        this.connectNonce = nonce.trim();
        this.sendConnect();
        return;
      }
      if (parsed.event === "tick") {
        this.lastTick = Date.now();
      }
      this.opts.onEvent?.(parsed);
      return;
    }

    if (isResponseFrame(parsed)) {
      this.lastTick = Date.now();
      const pending = this.pending.get(parsed.id);
      if (!pending) {
        return;
      }
      this.pending.delete(parsed.id);
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      if (parsed.ok) {
        pending.resolve(parsed.payload);
      } else {
        pending.reject(
          new Error(
            parsed.error?.message ?? `request failed: ${parsed.error?.code ?? "unknown"}`,
          ),
        );
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.closed) {
      return;
    }
    this.connectedAtMs = null;
    this.reconnectCount++;
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
    this.reconnectTimer = setTimeout(() => this.start(), delay);
    this.reconnectTimer.unref();
  }

  private flushPendingErrors(err: Error): void {
    for (const [, p] of this.pending) {
      if (p.timeout) {
        clearTimeout(p.timeout);
      }
      p.reject(err);
    }
    this.pending.clear();
  }

  private startTickWatch(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
    }
    const interval = Math.max(this.tickIntervalMs, 1000);
    this.tickTimer = setInterval(() => {
      if (this.closed || !this.lastTick) {
        return;
      }
      const gap = Date.now() - this.lastTick;
      if (gap > this.tickIntervalMs * 2) {
        this.ws?.close(4000, "tick timeout");
      }
    }, interval);
    this.tickTimer.unref();
  }
}
