import axios from "axios";
import puppeteer from "puppeteer-core";
import { mkdir, stat } from 'node:fs/promises';

/**
 * 异步等待
 */
export function sleep(timeout: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
}

export async function launchBrowser() {
  const debugUrl = 'http://localhost:9222';
  const { data } = await axios.get(`${debugUrl}/json/version`);
  const browserWSEndpoint = data.webSocketDebuggerUrl; // 这是动态变化的地址
  const browser = await puppeteer.connect({
    browserWSEndpoint: browserWSEndpoint,
    defaultViewport: null,
  });

  return browser;
}

/**
 * 检查文件系统中是否存在目录，可选择不存在时是否创建
 * @param dirPath 目录路径
 * @param create 不存在时是否创建，默认为 true
 */
export async function ensureDir(dirPath: string, create: boolean = true): Promise<void> {
  try {
    const stats = await stat(dirPath);
    if (!stats.isDirectory()) {
      throw new Error(`${dirPath} 存在但不是目录`);
    }
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      if (create) {
        await mkdir(dirPath, { recursive: true });
      } else {
        throw new Error(`目录 ${dirPath} 不存在`);
      }
    } else {
      throw err;
    }
  }
}
