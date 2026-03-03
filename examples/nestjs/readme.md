# Nest 网关示例

基于 NestJS 的 CDP Client 网关，引用 `@bomon/nestjs-cct-explorer` 提供资源浏览器 HTTP 与 `/browser` 页面，设备通过 Socket.IO 连接。

**English** · [README (English)](readme.en.md)

## 运行

```bash
# 在仓库根目录
pnpm install
pnpm -F @bomon/nestjs-cct-explorer build   # 先构建 explorer 模块
pnpm -F nestjs-gateway-example start       # 或 cd examples/nestjs && pnpm start
```

访问 http://localhost:3000/browser 打开资源浏览器。

## 结构

- `src/main.ts`：创建 Nest 应用，将 Socket.IO 挂到同一 HTTP 服务器并注入到 `SocketIoDeviceGateway`。
- `src/app.module.ts`：注册 `CctExplorerModule`，提供 `DEVICE_GATEWAY_TOKEN` 为 `SocketIoDeviceGateway`。
- `src/socket-io-device.gateway.ts`：实现 `DeviceGateway`，维护设备 Map，通过 Socket 事件转发 `read_dir` / `read_file` / `rm` 等；并实现 `getScriptQueue(device)`，供资源浏览器展示脚本队列与已运行时间。

客户端（如 examples/client）连接时需带上 `deviceName`（如 query 或 auth），网关据此区分设备并响应 HTTP 请求。资源浏览器页会定时请求 `GET /api/devices` 获取设备列表及每设备的脚本队列状态（由 CctExplorer 模块内定时向各设备拉取并缓存）。
