# @bomon/nestjs-cct-explorer

NestJS 模块：为 CDP Client 网关提供设备资源浏览器 HTTP 接口与 `/browser` 页面。

**English** · [README (English)](readme.en.md)

## 安装

```bash
pnpm add @bomon/nestjs-cct-explorer
# 或
npm i @bomon/nestjs-cct-explorer
```

## 使用

1. 在你的网关项目中实现 `DeviceGateway` 接口（例如基于 Socket.IO 转发到设备）。
2. 在根模块中通过 `forRoot` 传入你的网关类（需实现 `DeviceGateway`）：

```ts
import { Module } from '@nestjs/common';
import { CctExplorerModule } from '@bomon/nestjs-cct-explorer';
import { SocketIoDeviceGateway } from './socket-io-device.gateway'; // 你的实现

@Module({
  imports: [
    CctExplorerModule.forRoot({
      deviceGatewayClass: SocketIoDeviceGateway, // 必填
      pathPrefix: '', // 可选，例如 'cct' 时需配合挂载路径
      scriptQueuePollIntervalMs: 1000, // 可选，默认 1000。模块内定时向所有设备拉取 script_queue 并缓存，GET api/devices 会带上 scriptQueue/queueUpdatedAt/queueError；设为 0 则关闭轮询
    }),
  ],
})
export class AppModule {}
```

3. 若使用全局前缀（如 `setGlobalPrefix('cct')`），则访问 `http://localhost:3000/cct/browser`，页面内 API 使用相对路径，会自动请求 `/cct/api/*`。

## 路由

| 路径 | 方法 | 说明 |
|------|------|------|
| `/browser` | GET | 资源浏览器单页（设备列表、目录树、文件操作、脚本队列面板） |
| `/api/devices` | GET | 设备列表。当 `scriptQueuePollIntervalMs > 0` 且网关实现 `getScriptQueue` 时，每个设备会附带 `scriptQueue`、`queueUpdatedAt`、`queueError`（模块内定时轮询各设备并缓存） |
| `/api/scripts/queue` | GET | 单设备脚本队列：`?device=设备名`，返回 `{ running, pending, capacity }`（有缓存时优先返回缓存，需网关实现 `getScriptQueue`） |
| `/api/fs/dir` | GET | 读目录 |
| `/api/fs/file` | GET | 读文件 |
| `/api/fs/file` | DELETE | 删文件 |
| `/api/fs/file` | POST | 写文件（需网关实现 writeFile） |

## 依赖

需实现并注入 `DeviceGateway`（见包内 `device-gateway.interface.ts`）。若需资源浏览器中的「脚本队列」展示，需实现可选方法 `getScriptQueue(device: string): Promise<ScriptQueueSnapshot>`。
