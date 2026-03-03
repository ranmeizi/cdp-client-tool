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

**Script execution**: `exec_local_script` (queue), `exec_remote_script` (queue), `script_queue` (returns `{ running, pending, capacity }`). Queue capacity 10; responses: `executing` / `queued` / `overflow`. Entry: `module.exports = async function capture(ctx) { ... }`.

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
| Read dir | GET | `/api/fs/dir?device=&path=` | `{ entries: [{ name, type }] }`, type file or dir |
| Read file | GET | `/api/fs/file?device=&path=` | File stream with Content-Type / Content-Disposition |
| Delete file | DELETE | `/api/fs/file?device=&path=` | `{ ok: true, message: "deleted" }` |
| Write file (optional) | POST | `/api/fs/file` | Body `{ device, path, content }`; forwarded to device `set_file` |

Error body: `{ "code": "400"|"404"|"500", "message": "string" }`.

---

## Open issues

Memory leaks, network timeouts, client file management (scripts / screenshots).

---

## Publish to npm

`npm login`, then from repo root: `pnpm run build` and `npm publish`. Scoped package has `publishConfig.access: "public"`. Version: `npm version patch|minor|major` then `npm publish`.
