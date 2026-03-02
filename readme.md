# CDP-CLIENT-TOOL

为开发运行在安卓机linux系统上的数据抓取client端提供工具

## 设计

1. 获取客户端状态
提供一些函数获取客户端的状态，例如客户端是否存在脚本文件

2. 下发/执行脚本
可以直接下发符合mjs的字符串脚本，也可以将脚本存放至客户端再执行

3. 控制
使用 socket.io 链接网关控制，提供一套控制用的标准

4. 安卓浏览器控制
使用 puppeteer-core 通过 CDP 控制浏览器，提供一些常用代码流程

## 环境搭建

### 通用

1. 安装 git / nodejs  
2. 安装 chrome浏览器

### windows/macos

1. 使用启动项--remote-debugging-port=9222 --user-data-dir chrome 启动 浏览器,macos 使用```open -n -a "Google Chrome" --args \
    --remote-debugging-port=9222 \
    --user-data-dir="/Users/boboan/Library/Application Support/Google/Chrome/Profile 1"```
2. 启动项目连接网关(启动example,这个项目只提供一个常规实现，更多个性化请自己写event交互)

### android

需要在安卓机上安装一套可于行的 linux 环境 (termux / aidlux)

1. 安装 android-tools
2. 打开手机usb调试，使用数据线连接安卓手机，输入```adb tcpip 5555``` 打开远程调试端口
3. 输入```adb connect 192.168.1.100:5555``` 链接安卓手机
4. 输入```adb forward tcp:9222 localabstract:chrome_devtools_remote``` 打开手机chrome开发者端口，代码会使用 9222 端口
5. 启动项目连接网关(启动example,这个项目只提供一个常规实现，更多个性化请自己写event交互)

手机重启后需要重新连接并打开 9222 端口

## 关于网关

默认是用 socket.io 链接的，如果需要其他链接方式，你可以再 onInit 中自己写代码连接，不过建议还是使用 socket.io 能省很多事


### Event

类型
```ts
type SendMessageType<T = any> = {
    payload: T
}

type ReturnMessageType<T = any> = {
    code: string,
    payload: T
}
```

客户端预设

**文件系统用**
- set_file 保存文件
    payload example:
    ```ts
    {
        payload:{
            filename: 'script',
            content: `
                /**
                 * @type {import('cdp-client-tool').excuteFn}
                 */
                async function capture(ctx) {
                    const browser = ctx.browser

                    console.log("I'm running", ctx)

                    return ctx.greeting
                }

                module.exports = capture
            `
        }
    }
    ```

    保存文件到 运行目录下的 local_scripts 目录下,如果没有将新建目录
- read_dir 读取目录
    payload example:

    ```ts
    {
        payload:{
            path:"/local_scripts"
        }
    }
    ```

- read_file 读取文件
    payload example:

    ```ts
    {
        payload:{
            path:"/local_scripts/baidu.js"
        }
    }
    ```

    注意 只允许读取 local_scripts 和 screenshots 目录，其他的会被拒绝

- rm 删除文件
    payload example:

    ```ts
    {
        payload:{
            path:"/local_scripts/baidu.js"
        }
    }
    ```

    注意 只允许删除 local_scripts 和 screenshots 目录下的文件，其他的会被拒绝

- is_file_exist 检测文件是否存在
    payload example:

    ```ts
    {
        payload:{
            path:"/local_scripts/baidu.js"
        }
    }
    ```

**运行脚本用**

- exec_local_script 运行脚本
    payload example:

    ```ts
    {
        payload:{
            path:"/{device_name}/local_scripts/baidu.js"
        }
    }
    ```
- exec_remote_script 运行远程脚本

其余你自己自定义

## 架构说明（网关 + 资源浏览器）

```
                    HTTP (页面 + 接口)
    ┌─────────────── Browser ───────────────┐
    │                                       │
    │  资源浏览器 UI                          │
    │  (按设备 → local_scripts/screenshots   │
    │   展示目录树、预览/下载文件、删除等)       │
    └─────────────────┬─────────────────────┘
                      │
                      ▼
    ┌────────────── Express 网关 ────────────┐
    │  • HTTP API：设备列表、目录、读文件、删文件  │
    │  • Socket.IO Server：接收多设备连接        │
    │  • 将 HTTP 请求转发为对应设备的 socket 事件 │
    └─────────────────┬─────────────────────┘
                      │ Socket.IO
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   Device A      Device B      Device C
   (client)      (client)      (client)
   本地目录:      本地目录:      本地目录:
   local_scripts local_scripts local_scripts
   screenshots   screenshots   screenshots
```


- 多个 **Device**（运行 cdp-client-tool 的客户端）通过 Socket.IO 连接到同一 **Express 网关**。
- 连接时客户端会上报自己的 **设备名**（如 `gateway.name` 或握手参数），网关用该名字作为「虚拟根」区分设备。
- 前端通过 **HTTP 接口** 访问「设备 → 目录 → 文件」的虚拟结构；网关再通过 Socket.IO 向对应设备发起 `read_dir` / `read_file` / `rm` 等事件并汇总结果。

---

## HTTP 接口规范

用于在 example 中实现「基于 Socket.IO 的文件系统资源浏览器」：前端只调 HTTP，网关内部转成对指定设备的 Socket 调用。

**约定**

- **Base URL**：由网关决定，例如 `http://localhost:3000`。
- **路径规范**：所有涉及路径的接口统一使用 **虚拟路径**，格式为 `/{device_name}/<相对路径>`。
  - 允许的根目录只有两段：`/{device_name}/local_scripts/...` 和 `/{device_name}/screenshots/...`。
  - 例如：`/device1/local_scripts/baidu.js`、`/device2/screenshots/login.png`。
- **设备名**：来自设备连接网关时的命名（如客户端 `GatewayConfig.name` 或 Socket 握手时的 `deviceName`），由网关维护「Socket ↔ device_name」映射。

**统一 JSON 错误体**

```ts
// 4xx/5xx 时 JSON body
{
  "code": "400" | "404" | "500",
  "message": "string"
}
```

---

### 1. 获取设备列表

用于资源浏览器第一级展示「所有在线设备」。

| 项目 | 说明 |
|------|------|
| **Method** | `GET` |
| **Path** | `/api/devices` |
| **Query** | 无 |
| **Response 200** | `{ "devices": [{ "name": string, "connectedAt?: string }] }` |

示例：

```json
{
  "devices": [
    { "name": "device1", "connectedAt": "2025-03-02T10:00:00.000Z" },
    { "name": "device2" }
  ]
}
```

- `name`：设备名，后续所有接口的 `path` 都以 `/{name}/...` 开头。
- `connectedAt`：可选，该设备连接时间（ISO 8601）。

---

### 2. 读取目录（列表当前目录下的条目）

一次只返回**某一个目录**下的直接子项（文件/文件夹名），用于前端按层级展示树形结构。

| 项目 | 说明 |
|------|------|
| **Method** | `GET` |
| **Path** | `/api/fs/dir` |
| **Query** | `device`（必填）：设备名；`path`（必填）：虚拟路径，如 `/device1/local_scripts` 或 `/device1/screenshots` |
| **校验** | `path` 必须以 `/{device_name}/local_scripts` 或 `/{device_name}/screenshots` 开头（或等于该路径）；且 `path` 中的 device 与 query 的 `device` 一致 |
| **Response 200** | `{ "entries": [{ "name": string, "type": "file" 或 "dir" }] }` |

说明：网关内部把虚拟路径转成设备侧路径后，向该设备的 Socket 发送 `read_dir` 事件（如虚拟路径 `/{device}/local_scripts` → 设备侧 `local_scripts` 或 `/local_scripts`）。

示例请求：

```
GET /api/fs/dir?device=device1&path=/device1/local_scripts
```

示例响应：

```json
{
  "entries": [
    { "name": "baidu.js", "type": "file" },
    { "name": "tasks", "type": "dir" }
  ]
}
```

若设备侧 `read_dir` 只返回名称列表，网关可根据扩展名或再请求推断 `type`；若设备侧能返回类型则直接映射。

错误：`400` 路径不合法；`404` 设备未连接或路径不存在；`500` 设备执行失败。

---

### 3. 读取文件（下载/预览）

返回文件内容，用于预览或下载。只允许 `/{device_name}/local_scripts/...` 和 `/{device_name}/screenshots/...`。

| 项目 | 说明 |
|------|------|
| **Method** | `GET` |
| **Path** | `/api/fs/file` |
| **Query** | `device`（必填）；`path`（必填）：虚拟路径，如 `/device1/local_scripts/baidu.js` |
| **校验** | 同「读取目录」的路径前缀规则 |
| **Response 200** | 直接返回文件二进制流；建议设置 `Content-Type` 和 `Content-Disposition: inline; filename="xxx"`（预览）或 `attachment; filename="xxx"`（下载） |

示例请求：

```
GET /api/fs/file?device=device1&path=/device1/local_scripts/baidu.js
```

错误：`400` 路径不合法；`404` 设备未连接或文件不存在；`500` 设备执行失败。

---

### 4. 删除文件

只允许删除上述两棵目录树下的文件。

| 项目 | 说明 |
|------|------|
| **Method** | `DELETE` |
| **Path** | `/api/fs/file` |
| **Query** | `device`（必填）；`path`（必填）：虚拟路径，如 `/device1/screenshots/old.png` |
| **校验** | 同「读取目录」的路径前缀规则 |
| **Response 200** | `{ "ok": true, "message": "deleted" }` 或 204 No Content |

示例请求：

```
DELETE /api/fs/file?device=device1&path=/device1/screenshots/old.png
```

错误：`400` 路径不合法；`404` 设备未连接或文件不存在；`500` 设备执行失败。

---

### 5. 写入文件（可选）

若资源浏览器需要「上传/保存文件到设备」，可提供。

| 项目 | 说明 |
|------|------|
| **Method** | `POST` 或 `PUT` |
| **Path** | `/api/fs/file` |
| **Body** | `Content-Type: application/json`；`{ "device": string, "path": string, "content": string }`。二进制可用 `multipart/form-data` 或 Base64 的 `content` |
| **校验** | 同上，仅允许 `/{device}/local_scripts/...` 或 `/{device}/screenshots/...` |
| **Response 200** | `{ "ok": true, "message": "saved" }` |

网关内部转为对设备的 `set_file` 事件（payload 的 filename 与当前客户端约定一致）。

---

### 虚拟目录结构小结

对前端而言，可见结构为：

```
/{device_name}/
├── local_scripts/
│   ├── xxx.js
│   └── ...
└── screenshots/
    ├── xxx.png
    └── ...
```

- `read_dir`：只返回**某一层**的直接子项（名称 + 类型）。
- `read_file`：按 `device + path` 取文件流。
- `rm`：按 `device + path` 删文件。
- 所有 path 必须落在 `/{device_name}/local_scripts/...` 或 `/{device_name}/screenshots/...`，否则返回 400。

---

## 需要解决的问题

- 内存泄漏
- 网络超时
- 执行队列
- 客户端文件管理(脚本/截图)