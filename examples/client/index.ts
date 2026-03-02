/**
 * client 子工程引用根目录开发的 cdp-client-tool 模块
 * 使用前需在仓库根目录执行: pnpm run build
 */
import { Client, EVENTS } from "@bomon/cdp-client-tool";

const client = new Client({
  deviceName: "example-device",
  gateways: [
    {
      name: "local",
      uri: "http://localhost:3000",
    },
  ],
});

console.log("Client 已创建，事件枚举:", EVENTS);
