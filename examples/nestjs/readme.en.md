# Nest gateway example

NestJS-based CDP Client gateway using `@bomon/nestjs-cct-explorer` for the resource browser HTTP API and `/browser` page; devices connect via Socket.IO.

**中文** · [README (中文)](readme.md)

---

## Run

```bash
# From repo root
pnpm install
pnpm -F @bomon/nestjs-cct-explorer build   # Build explorer module first
pnpm -F nestjs-example start              # or cd examples/nestjs && pnpm start
```

Open http://localhost:3000/browser for the resource browser.

## Structure

- `src/main.ts`: Creates the Nest app, attaches Socket.IO to the same HTTP server and injects it into `SocketIoDeviceGateway`.
- `src/app.module.ts`: Registers `CctExplorerModule` and provides `DEVICE_GATEWAY_TOKEN` as `SocketIoDeviceGateway`.
- `src/socket-io-device.gateway.ts`: Implements `DeviceGateway`, keeps a device map, forwards `read_dir` / `read_file` / `rm` via Socket; implements `getScriptQueue(device)` for the resource browser script queue and elapsed time.

Clients (e.g. examples/client) must send `deviceName` (query or auth); the gateway uses it to route HTTP requests. The resource browser periodically requests `GET /api/devices` for the device list and per-device script queue state (CctExplorer module polls devices and caches).
