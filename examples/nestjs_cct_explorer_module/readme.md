# @bomon/nestjs-cct-explorer

NestJS 模块：为 CDP Client 网关提供设备资源浏览器 HTTP 接口与 `/browser` 页面。

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
    }),
  ],
})
export class AppModule {}
```

3. 若使用全局前缀（如 `setGlobalPrefix('cct')`），则访问 `http://localhost:3000/cct/browser`，页面内 API 使用相对路径，会自动请求 `/cct/api/*`。

## 路由

| 路径 | 方法 | 说明 |
|------|------|------|
| `/browser` | GET | 资源浏览器单页 |
| `/api/devices` | GET | 设备列表 |
| `/api/fs/dir` | GET | 读目录 |
| `/api/fs/file` | GET | 读文件 |
| `/api/fs/file` | DELETE | 删文件 |
| `/api/fs/file` | POST | 写文件（需网关实现 writeFile） |

## 依赖

需实现并注入 `DeviceGateway`（见包内 `device-gateway.interface.ts`）。
