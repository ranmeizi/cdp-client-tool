# @bomon/nestjs-cct-explorer

NestJS module that provides device resource browser HTTP API and `/browser` page for CDP Client gateways.

**中文** · [README (中文)](readme.md)

---

## Install

```bash
pnpm add @bomon/nestjs-cct-explorer
# or
npm i @bomon/nestjs-cct-explorer
```

## Usage

1. Implement the `DeviceGateway` interface in your gateway project (e.g. Socket.IO forwarding to devices).
2. Pass your gateway class via `forRoot` in the root module:

```ts
import { Module } from '@nestjs/common';
import { CctExplorerModule } from '@bomon/nestjs-cct-explorer';
import { SocketIoDeviceGateway } from './socket-io-device.gateway'; // your implementation

@Module({
  imports: [
    CctExplorerModule.forRoot({
      deviceGatewayClass: SocketIoDeviceGateway, // required
      pathPrefix: '', // optional, e.g. 'cct' with matching mount path
      scriptQueuePollIntervalMs: 1000, // optional, default 1000. Module polls all devices for script_queue and caches; GET devices includes scriptQueue/queueUpdatedAt/queueError; set 0 to disable
    }),
  ],
})
export class AppModule {}
```

3. With a global prefix (e.g. `setGlobalPrefix('cct')`), open `http://localhost:3000/cct/browser`; the page uses relative paths and will request `/cct/devices`, `/cct/fs/*`, etc.

## Routes

| Path | Method | Description |
|------|--------|-------------|
| `/browser` | GET | Resource browser SPA (device list, directory tree, file actions, script queue panel) |
| `/devices` | GET | Device list. When `scriptQueuePollIntervalMs > 0` and gateway implements `getScriptQueue`, each device includes `scriptQueue`, `queueUpdatedAt`, `queueError` (module polls and caches) |
| `/scripts/queue` | GET | Single-device script queue: `?device=name`, returns `{ running, pending, capacity }` (uses cache when available; requires gateway `getScriptQueue`) |
| `/scripts/interrupt` | POST | Interrupt running script: `{ device, jobId }`; requires gateway `interruptScript` |
| `/scripts/undo` | POST | Undo queued/running task: `{ device, jobId }`; requires gateway `undoScript` |
| `/fs/dir` | GET | List directory |
| `/fs/file` | GET | Read file |
| `/fs/file` | DELETE | Delete file |
| `/fs/file` | POST | Write file (requires gateway `writeFile`) |

## Dependencies

Implement and inject `DeviceGateway` (see `device-gateway.interface.ts` in the package). For the script queue panel in the resource browser, implement the optional `getScriptQueue(device: string): Promise<ScriptQueueSnapshot>`.
