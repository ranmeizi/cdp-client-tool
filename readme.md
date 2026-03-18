# CDP-CLIENT-TOOL

一个客户端程序，通过 Socket.IO 与 HTTP 接口与网关通信，用于控制浏览器、抓取数据等。适用于在安卓机 / Linux 上运行的数据抓取 Client。

**English** · [README (English)](readme.en.md)

- **包名**：`cdp-client-tool`
- **入口**：`Client`、`EVENTS`、类型 `ClientOptions` / `GatewayConfig` / `excuteFn`

## 快速开始

```bash
# 安装依赖并构建
pnpm install
pnpm run build
```

**作为客户端连接网关：**

```ts
import { Client } from "cdp-client-tool";

const client = new Client({
  deviceName: "my-device",   // 网关侧展示的设备名
  gateways: [
    { name: "local", uri: "http://localhost:3000" },
  ],
});
```

**启动示例网关 + 资源浏览器：**

```bash
pnpm run start:express   # 启动 Express 网关
# 浏览器打开 http://localhost:3000/browser
pnpm run start:client   # 启动示例 Client 连接网关
```

---

## 设计

1. **客户端状态**：提供获取客户端状态的能力（如是否存在某脚本文件）。
2. **下发 / 执行脚本**：可下发脚本字符串执行，或将脚本放在客户端 `local_scripts` 后通过事件执行。脚本在 Node 中以 **CommonJS** 形式运行，可使用 `require()` 引用其他 CJS 模块。
3. **控制**：通过 Socket.IO 连接网关，提供统一的控制事件协议。
4. **浏览器控制**：使用 puppeteer-core 通过 CDP 控制浏览器，封装常用流程。

---

## 环境搭建

### 通用

1. 安装 Git、Node.js  
2. 安装 Chrome 浏览器  

### Windows / macOS

1. 使用 `--remote-debugging-port=9222` 启动 Chrome。  
   macOS 示例：
   ```bash
   open -n -a "Google Chrome" --args \
     --remote-debugging-port=9222 \
     --user-data-dir="/Users/xxx/Library/Application Support/Google/Chrome/Profile 1"
   ```
2. 启动项目并连接网关（可先启动 example 网关，再启动 client）。

### Android

需在安卓上安装可运行 Node 的 Linux 环境（如 Termux / AidLux）。

1. 安装 android-tools  
2. 开启 USB 调试，数据线连接后执行：`adb tcpip 5555`  
3. 连接手机：`adb connect 192.168.1.100:5555`  
4. 转发 Chrome 调试端口：`adb forward tcp:9222 localabstract:chrome_devtools_remote`  
5. 启动项目连接网关  

手机重启后需重新执行 adb 连接与端口转发。

---

## 网关与 Socket 协议

默认通过 Socket.IO 连接网关；如需其他传输可在 `onInit` 中自行实现，建议仍使用 Socket.IO 以复用现有事件协议。

### 消息类型

```ts
type SendMessageType<T = any> = { payload: T }
type ReturnMessageType<T = any> = { code: string; payload: T }
```

### 客户端预设事件（网关 → 设备）

**文件系统**

| 事件 | 说明 | payload |
|------|------|--------|
| `set_file` | 保存文件到 `local_scripts` 目录 | `{ filename, content }` |
| `read_dir` | 读取目录，返回 `{ name, type: 'file' \| 'dir' }[]` | `{ path }`，如 `"local_scripts"` |
| `read_file` | 读取文件内容（仅允许 local_scripts、screenshots） | `{ path }` |
| `rm` | 删除文件（仅允许上述两目录） | `{ path }` |
| `is_file_exist` | 检测文件是否存在 | `{ path }` |

**脚本执行**

| 事件 | 说明 | payload |
|------|------|--------|
| `exec_local_script` | 执行 `local_scripts` 下脚本，CJS 运行可 `require()`，走脚本队列 | `{ filename, params? }`，如 `{ filename: "task1.cjs", params: { share_code: "hk-00700" } }` |
| `exec_remote_script` | 执行下发的脚本字符串（类 CJS 环境，可 `require`），走脚本队列 | `{ raw: Buffer, params? }` |
| `script_queue` | 查询当前设备脚本队列快照（网关轮询或按需拉取） | `{}`，回调返回 `{ running, pending, capacity }` |
| `interrupt_script` | 中断脚本：排队中则移除，运行中则 terminate Worker，队列会自动执行下一任务 | `{ jobId }`，回调返回 `{ ok: boolean, reason?: string }` |
| `undo_script` | 撤销脚本：与 `interrupt_script` 同逻辑，用于排队任务撤销 | `{ jobId }`，回调返回 `{ ok: boolean, reason?: string }` |

脚本执行采用队列（默认容量 10）：请求会立即返回 `executing` / `queued` / `overflow`，实际在队列中顺序执行。脚本入口：`module.exports = async function capture(ctx) { ... }`，类型为 `import('cdp-client-tool').excuteFn`，`ctx` 含 `browser`、`greeting`、`params`（server 下发的可选参数）。资源浏览器中，鼠标悬停任务可查看 params。可通过 `interrupt_script` / `undo_script` 中断运行中或撤销排队中的任务。下发脚本时返回执行 id，网关可据此下发取消任务。

**示例：exec_local_script**

```ts
// 网关或调用方发送，可带 params 传递参数给脚本
socket.emit('exec_local_script', {
  payload: {
    filename: 'task1.cjs',
    params: { share_code: 'hk-00700' }
  }
}, (result) => console.log(result));
```

**示例：set_file**

```ts
socket.emit('set_file', {
  payload: {
    filename: 'script.js',
    content: `
      async function capture(ctx) { return ctx.greeting; }
      module.exports = capture;
    `
  }
}, (res) => console.log(res));
```

其余事件可自定义扩展。

---

## 架构说明（网关 + 资源浏览器）

```
                    HTTP (页面 + 接口)
    ┌─────────────── Browser ───────────────┐
    │  资源浏览器 UI：设备列表、脚本队列（运行中│
    │  + 已运行时间、排队）、local_scripts /   │
    │  screenshots 目录树、预览/下载、删除     │
    └─────────────────┬─────────────────────┘
                      ▼
    ┌────────────── Express 网关 ────────────┐
    │  HTTP API：设备列表、目录、读/删文件    │
    │  Socket.IO：多设备连接，HTTP 转事件    │
    └─────────────────┬─────────────────────┘
                      │ Socket.IO
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   Device A      Device B      Device C
   local_scripts local_scripts local_scripts
   screenshots   screenshots   screenshots
```

- 多台设备（运行本库的 Client）通过 Socket.IO 连接同一网关，连接时上报 `deviceName`，网关以此区分设备。  
- 前端通过 HTTP 访问「设备 → 目录 → 文件」的虚拟结构，网关将请求转为对对应设备的 `read_dir` / `read_file` / `rm` 等事件。  
- 网关定时向各设备拉取 `script_queue` 并缓存；前端定时请求 GET `/api/devices` 获取设备列表及每设备的脚本队列状态，资源浏览器页展示「运行中脚本 + 已运行时间」与排队列表。

---

## HTTP 接口规范（资源浏览器）

Base 示例：`http://localhost:3000`。路径统一为虚拟路径：`/{device_name}/local_scripts/...` 或 `/{device_name}/screenshots/...`。

**错误体**：`{ "code": "400" | "404" | "500", "message": "string" }`

| 接口 | Method | Path | 说明 |
|------|--------|------|------|
| 设备列表 | GET | `/api/devices` | `{ devices: [{ name, connectedAt?, scriptQueue?, queueUpdatedAt?, queueError? }] }`，网关定时拉取各设备 `script_queue` 并缓存，供前端轮询 |
| 脚本队列 | GET | `/api/scripts/queue?device=` | `{ running, pending, capacity }`，单设备队列快照（可走缓存） |
| 中断脚本 | POST | `/api/scripts/interrupt` | Body: `{ device, jobId }`，转设备 `interrupt_script`，返回 `{ ok: boolean }` |
| 撤销脚本 | POST | `/api/scripts/undo` | Body: `{ device, jobId }`，转设备 `undo_script`，返回 `{ ok: boolean }` |
| 读目录 | GET | `/api/fs/dir?device=&path=` | `{ entries: [{ name, type }] }`，type 为 file 或 dir |
| 读文件 | GET | `/api/fs/file?device=&path=` | 文件流，带 Content-Type / Content-Disposition |
| 删文件 | DELETE | `/api/fs/file?device=&path=` | `{ ok: true, message: "deleted" }` |
| 写文件（可选） | POST | `/api/fs/file` | Body: `{ device, path, content }`，转设备 `set_file` |

虚拟结构：`/{device_name}/local_scripts/...`、`/{device_name}/screenshots/...`，path 须落在此两棵树下，否则 400。
