<h1 align="center">NodeClaw</h1>

<p align="center">
  <strong>Minimal OpenClaw node protocol client — everything a node needs, nothing it doesn't.</strong>
</p>

<p align="center">
  Full protocol v3 compatibility · Ed25519 device identity · Auto-reconnect · systemd/launchd ready
</p>

<p align="center">
  <a href="https://github.com/scottgl9/NodeClaw/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License" /></a>
  <a href="https://github.com/scottgl9/NodeClaw/stargazers"><img src="https://img.shields.io/github/stars/scottgl9/NodeClaw" alt="GitHub stars" /></a>
  <a href="https://github.com/scottgl9/NodeClaw/actions"><img src="https://img.shields.io/github/actions/workflow/status/scottgl9/NodeClaw/ci.yml?branch=main" alt="Build" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node.js >= 20" />
  <img src="https://img.shields.io/badge/tests-99%20passing-brightgreen" alt="99 tests passing" />
</p>

---

## Quick Start

```bash
npm install -g nodeclaw

# Pair with your OpenClaw gateway
nodeclaw pair wss://my-gateway:18789

# Start the node daemon
nodeclaw start
```

That's it. NodeClaw connects to your [OpenClaw](https://github.com/openclaw/openclaw) gateway and receives tasks — shell execution, system metrics, binary lookup — over a single outbound WebSocket.

## Why NodeClaw?

Running a full OpenClaw instance on every device is heavyweight. The full stack includes a gateway daemon, 20+ channel adapters, agent runtime, skills system, workspace, memory, and web UI. For devices that only need to **receive tasks and execute them**, none of that is needed.

|                            | What you get                                                                 |
| -------------------------- | ---------------------------------------------------------------------------- |
| **Minimal footprint**      | Single 42KB bundle, < 50MB RSS at idle — runs on Raspberry Pi, NAS, any VPS |
| **Full protocol compat**   | Pairs and communicates with any OpenClaw gateway (protocol v3)               |
| **Zero gateway**           | No HTTP server, no channel adapters, no agent runtime, no web UI             |
| **Secure by design**       | Ed25519 identity, challenge-nonce handshake, no inbound ports                |
| **Operationally simple**   | Single config file, single process, systemd/launchd ready                    |
| **Auto-reconnect**         | Exponential backoff (1s → 30s), tick-based health monitoring                 |

## How it compares

| Feature                |     NodeClaw      |       Full OpenClaw       |
| ---------------------- | :---------------: | :-----------------------: |
| Receive & execute tasks |        Yes        |           Yes             |
| Gateway / HTTP server  |        No         |           Yes             |
| Channel adapters       |        No         |     20+ (Discord, etc.)   |
| Agent runtime / LLM    |        No         |           Yes             |
| Skills / memory / UI   |        No         |           Yes             |
| Idle memory            |     < 50 MB       |        200+ MB            |
| Install footprint      |      42 KB        |      200+ MB npm          |
| Startup time           |      < 2s         |        5–10s              |
| Service management     | systemd / launchd | pm2 / Docker              |
| Config complexity      |  Single JSON file | Multi-file + env + DB     |

## Target Use Cases

- **Edge / SBC devices** — Raspberry Pi, Rock64 — remote shell + metrics without the full Node.js stack
- **Dedicated workstation** — dev machine or home server as a pure execution target
- **VPS / cloud node** — lightweight instance for task dispatch at a fraction of the cost
- **Air-gapped / private network** — devices behind Tailscale or VPN, outbound WS only
- **Local inference node** *(future)* — GPU machine running Ollama, registered as an inference-capable node

## CLI Reference

```bash
# Pairing
nodeclaw pair <gateway-url>        # Pair with an OpenClaw gateway
nodeclaw unpair [--full]           # Remove pairing token (--full removes identity)

# Running
nodeclaw start                     # Start node daemon (foreground)

# Status
nodeclaw status                    # Show pairing and connection status
nodeclaw info                      # Show version, protocol, platform
nodeclaw doctor                    # Run configuration health checks

# Service management
nodeclaw install-service           # Install systemd (Linux) or launchd (macOS)
nodeclaw uninstall-service         # Remove installed service
```

## Configuration

**`~/.nodeclaw/config.json`**

```json
{
  "gateway": {
    "url": "wss://my-gateway:18789",
    "tlsVerify": true
  },
  "device": {
    "name": "pi-node-01",
    "workdir": "/home/pi/workspace"
  },
  "exec": {
    "blockedCommands": ["rm -rf /", "sudo"],
    "timeoutMs": 60000,
    "maxConcurrent": 3
  },
  "log": {
    "level": "info"
  }
}
```

Override the config directory with `NODECLAW_HOME=/custom/path`.

## Architecture

```
┌─────────────────────────────────────────────┐
│              NodeClaw Process               │
│                                             │
│  ┌──────────┐   ┌─────────────────────────┐│
│  │  CLI     │   │     Core Runtime        ││
│  │ (pair,   │   │                         ││
│  │  start,  │   │  ┌─────────────────┐   ││
│  │  status) │   │  │  WS Client      │   ││
│  └──────────┘   │  │  (gateway conn) │   ││
│                 │  └────────┬────────┘   ││
│                 │           │             ││
│                 │  ┌────────▼────────┐   ││
│                 │  │  Command Router │   ││
│                 │  └────────┬────────┘   ││
│                 │           │             ││
│                 │  ┌────────▼────────┐   ││
│                 │  │  Handlers       │   ││
│                 │  │  - system.run   │   ││
│                 │  │  - system.info  │   ││
│                 │  │  - system.which │   ││
│                 │  └─────────────────┘   ││
│                 └─────────────────────────┘│
└─────────────────────────────────────────────┘
           │ outbound WS only
           ▼
┌──────────────────────┐
│  OpenClaw Gateway    │
│  (host machine)      │
└──────────────────────┘
```

### Modules

| Module       | Description                                                     |
| ------------ | --------------------------------------------------------------- |
| `config/`    | Zod-validated config schema, loader, path resolution            |
| `crypto/`    | Ed25519 identity, v3 device auth payload, token store           |
| `protocol/`  | Wire frame types, connect params, node invoke types, guards     |
| `client/`    | WebSocket client — two-phase handshake, backoff, tick watch     |
| `pairing/`   | Device pairing flow with token persistence                      |
| `runtime/`   | Command router, event dispatch, node lifecycle                  |
| `handlers/`  | system.run (exec), system.info (metrics), system.which (lookup) |
| `service/`   | systemd unit and launchd plist generation                       |
| `cli/`       | Commander-based CLI — pair, start, status, unpair, doctor       |

## Security & Privacy

NodeClaw is designed for zero-trust environments. No inbound ports, no listening sockets.

|                            | NodeClaw                                                        |
| -------------------------- | --------------------------------------------------------------- |
| **Network posture**        | Outbound WebSocket only — no inbound ports, no HTTP server      |
| **Device identity**        | Ed25519 keypair, SHA-256 device ID, stored with `0600` perms    |
| **Authentication**         | Two-phase challenge-nonce handshake — prevents replay attacks   |
| **Transport**              | TLS validation enforced for `wss://`, no insecure override      |
| **Exec sandboxing**        | Commands bounded to configured `workdir` path                   |
| **Command policy**         | Configurable blocklist + concurrent execution limits            |
| **Output cap**             | 200KB stdout/stderr cap — prevents memory exhaustion            |
| **Timeout enforcement**    | Per-command timeout with SIGKILL escalation                     |

## Connection Lifecycle

```
nodeclaw pair <gateway-url>
  → WS connect to gateway
  → Receive connect.challenge (nonce)
  → Sign v3 auth payload with Ed25519
  → Send connect request with device identity
  → Gateway approves → device token stored

nodeclaw start
  → Load stored device token
  → WS connect with signed auth
  → Enter event loop:
      ← tick (heartbeat) → update health
      ← node.invoke.request → route to handler → execute → send result
      ← disconnect → reconnect with exponential backoff (1s → 30s)
```

## Development

```bash
git clone https://github.com/scottgl9/NodeClaw.git
cd NodeClaw
pnpm install
pnpm test          # 99 tests across 19 test files
pnpm build         # Build to dist/
pnpm dev start     # Run CLI in dev mode
pnpm typecheck     # TypeScript type checking
```

### Tech Stack

| Layer            | Choice       | Rationale                                        |
| ---------------- | ------------ | ------------------------------------------------ |
| Runtime          | Node.js 20+  | Matches OpenClaw's runtime, native crypto module |
| WS Client        | `ws`         | Battle-tested, minimal, same lib OpenClaw uses   |
| CLI              | `commander`  | Standard Node.js CLI framework                   |
| Config           | `zod`        | Schema validation with TypeScript inference      |
| Build            | `tsup`       | Fast ESM bundling with declarations              |
| Test             | `vitest`     | Fast, ESM-native test runner                     |

## Community

- [GitHub Issues](https://github.com/scottgl9/NodeClaw/issues) — Bug reports and feature requests
- [OpenClaw](https://github.com/openclaw/openclaw) — The gateway NodeClaw pairs with

## License

[MIT](LICENSE)
