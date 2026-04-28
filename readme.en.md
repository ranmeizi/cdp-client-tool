# CDP-CLIENT-TOOL

A client that talks to a gateway over Socket.IO and HTTP to control browsers and scrape data. Suited for data-scraping clients running on Android / Linux.

- **Package**: `cdp-client-tool`
- **Exports**: `Client`, `EVENTS`, types `ClientOptions` / `GatewayConfig` / `excuteFn`

**中文** · [README (中文)](readme.md)

---

## Quick start

```bash
pnpm install
pnpm run build
```

**Connect as a client:**

```ts
import { Client } from "cdp-client-tool";

const client = new Client({
  deviceName: "my-device",
  gateways: [
    { name: "local", uri: "http://localhost:3000" },
  ],
});
```

**Run example gateway and resource browser:**

```bash
pnpm run start:express   # Express gateway
# Open http://localhost:3000/browser
pnpm run start:client    # Example client
```

---

## Design

1. **Client state**: Expose client state (e.g. script file existence).
2. **Script deployment / execution**: Run script strings or scripts under `local_scripts` via events; Node CommonJS, can `require()`.
3. **Control**: Socket.IO to gateway, unified event protocol.
4. **Browser control**: puppeteer-core over CDP, common flows.

---

## Environment

- **General**: Git, Node.js, Chrome.
- **Windows / macOS**: Start Chrome with `--remote-debugging-port=9222`; then start project and connect to gateway.
- **Android**: Termux/AidLux, android-tools, USB debugging, `adb tcpip 5555`, `adb connect`, `adb forward tcp:9222 localabstract:chrome_devtools_remote`.

---

## Gateway and Socket protocol

Default: Socket.IO. Message types: `SendMessageType<T> = { payload: T }`, `ReturnMessageType<T> = { code: string; payload: T }`.

### Preset events (gateway → device)

**File system**: `set_file`, `read_dir`, `read_file`, `rm`, `is_file_exist`.

**Script execution**: `exec_local_script` (queue), `exec_remote_script` (queue), `script_queue` (returns `{ running, pending, capacity }`), `interrupt_script`, `undo_script`. Payload supports optional `params` for passing arguments to scripts. Queue capacity 10; responses: `executing` / `queued` / `overflow`. Entry: `module.exports = async function capture(ctx) { ... }`.

- `exec_local_script`: `{ filename, params? }`
- `exec_remote_script`: `{ raw: Buffer, params? }`
- `interrupt_script`: `{ jobId }` — interrupt running or remove queued job; callback `{ ok, reason? }`
- `undo_script`: `{ jobId }` — same as `interrupt_script` for undo semantics
- `ctx` includes `browser`, `greeting`, `params` (optional). Resource browser shows params on hover.

### Client report events (device → gateway)

- `report_result`: active result reporting from client to gateway for async script completion
- Payload: `{ jobId, result }`

Use `report_result` when `exec_*` returns immediately (`queued`/`executing`) and the final output is delivered asynchronously. On the gateway side, map pending actions by `jobId` and resolve/reject when the report arrives.

**Worker script example**

```js
const { sleep, reportResult } = require("cdp-client-tool");

async function main() {
  await sleep(1000);
  reportResult({ stage: "half" }); // optional progress message
  await sleep(1000);
  reportResult({ ok: true, data: { price: 123.45 } }); // final result
}

main().catch((e) => reportResult({ ok: false, error: e?.message || String(e) }));
```

---

## Architecture (gateway + resource browser)

Browser UI: device list, script queue (running + elapsed, pending), `local_scripts` / `screenshots` tree, preview/download/delete. Express gateway: HTTP API (devices, dir, read/delete), Socket.IO multi-device. Gateway polls `script_queue` per device and caches; front end polls GET `/api/devices` for device list and queue state.

---

## HTTP API (resource browser)

Base: `http://localhost:3000`. Virtual paths: `/{device_name}/local_scripts/...`, `/{device_name}/screenshots/...`.

| API | Method | Path | Description |
|-----|--------|------|-------------|
| Device list | GET | `/api/devices` | `{ devices: [{ name, connectedAt?, scriptQueue?, queueUpdatedAt?, queueError? }] }`; gateway caches per-device `script_queue` for front-end polling |
| Script queue | GET | `/api/scripts/queue?device=` | `{ running, pending, capacity }`; single-device snapshot (may use cache) |
| Interrupt script | POST | `/api/scripts/interrupt` | Body `{ device, jobId }`; forwards to device `interrupt_script`; returns `{ ok: boolean }` |
| Undo script | POST | `/api/scripts/undo` | Body `{ device, jobId }`; forwards to device `undo_script`; returns `{ ok: boolean }` |
| Read dir | GET | `/api/fs/dir?device=&path=` | `{ entries: [{ name, type }] }`, type file or dir |
| Read file | GET | `/api/fs/file?device=&path=` | File stream with Content-Type / Content-Disposition |
| Delete file | DELETE | `/api/fs/file?device=&path=` | `{ ok: true, message: "deleted" }` |
| Write file (optional) | POST | `/api/fs/file` | Body `{ device, path, content }`; forwarded to device `set_file` |

Error body: `{ "code": "400"|"404"|"500", "message": "string" }`.
