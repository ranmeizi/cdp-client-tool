import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';
import path from 'node:path';
import type { Socket } from 'socket.io';

const app = express();
const server = createServer(app);
const io = new Server(server);

const __dirname = dirname(fileURLToPath(import.meta.url));

type ScriptJobStatus = 'pending' | 'running' | 'success' | 'failed'

interface ScriptJob {
  id: string;
  type: 'local' | 'remote';
  filename?: string;
  description?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  status: ScriptJobStatus;
  errorMessage?: string;
}

interface ScriptQueueSnapshot {
  running: ScriptJob | null;
  pending: ScriptJob[];
  capacity: number;
}

// ---------- 设备注册：deviceName <-> socket ----------
const deviceNameToSocket = new Map<string, { socket: Socket; connectedAt: string }>();
const socketIdToDeviceName = new Map<string, string>();

interface DeviceQueueState {
  snapshot: ScriptQueueSnapshot | null;
  updatedAt: number;
  error?: string;
}

const deviceQueues = new Map<string, DeviceQueueState>();

function registerDevice(deviceName: string, socket: Socket) {
    const existing = deviceNameToSocket.get(deviceName);
    if (existing) existing.socket.disconnect(true);
    deviceNameToSocket.set(deviceName, {
        socket,
        connectedAt: new Date().toISOString(),
    });
    socketIdToDeviceName.set(socket.id, deviceName);
}

function unregisterDevice(socketId: string) {
    const name = socketIdToDeviceName.get(socketId);
    if (name) {
        deviceNameToSocket.delete(name);
        socketIdToDeviceName.delete(socketId);
    }
}

// ---------- 虚拟路径校验与转换 ----------
const ALLOWED_PREFIXES = ['local_scripts', 'screenshots'] as const;

function parseVirtualPath(deviceName: string, virtualPath: string): { devicePath: string } | { error: string; code: number } {
    const normalized = virtualPath.replace(/^\/+/, '').replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length < 2 || parts[0] !== deviceName) {
        return { error: 'path 须为 /{device_name}/local_scripts/... 或 /{device_name}/screenshots/...', code: 400 };
    }
    const second = parts[1];
    if (!ALLOWED_PREFIXES.includes(second as any)) {
        return { error: '仅允许 local_scripts 或 screenshots 目录', code: 400 };
    }
    const devicePath = parts.slice(1).join('/'); // local_scripts 或 local_scripts/xxx
    return { devicePath };
}

// ---------- Socket 转发：带超时的 emit+ack ----------
const SOCKET_ACK_TIMEOUT_MS = 15000;

function emitWithAck<T>(
    socket: Socket,
    event: string,
    payload: { payload: Record<string, unknown> }
): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('设备响应超时'));
        }, SOCKET_ACK_TIMEOUT_MS);
        socket.emit(event, payload, (ack: T) => {
            clearTimeout(timer);
            resolve(ack);
        });
    });
}

// ---------- 周期性刷新所有设备的脚本队列 ----------
let isRefreshingQueues = false;

async function refreshAllDeviceQueues() {
    const entries = Array.from(deviceNameToSocket.entries());
    if (!entries.length) return;

    const now = Date.now();
    await Promise.all(
        entries.map(async ([name, meta]) => {
            try {
                const snapshot = await emitWithAck<ScriptQueueSnapshot>(meta.socket, 'script_queue', {
                    payload: {},
                });
                deviceQueues.set(name, {
                    snapshot,
                    updatedAt: now,
                });
            } catch (err: any) {
                deviceQueues.set(name, {
                    snapshot: null,
                    updatedAt: now,
                    error: err?.message || '获取队列失败',
                });
            }
        })
    );
}

setInterval(() => {
    if (isRefreshingQueues) return;
    isRefreshingQueues = true;
    refreshAllDeviceQueues()
        .catch((err) => {
            console.error('刷新设备脚本队列失败:', err);
        })
        .finally(() => {
            isRefreshingQueues = false;
        });
}, 1000);

// ---------- 静态与页面 ----------
app.use('/static', express.static(join(__dirname, 'public')));
app.get('/browser', (req, res) => {
    res.sendFile(join(__dirname, 'public', 'browser.html'));
});

// ---------- HTTP API：设备列表 ----------
app.get('/api/devices', (req, res) => {
    const devices = Array.from(deviceNameToSocket.entries()).map(([name, meta]) => {
        const queueState = deviceQueues.get(name);
        return {
            name,
            connectedAt: meta.connectedAt,
            scriptQueue: queueState?.snapshot ?? null,
            queueUpdatedAt: queueState?.updatedAt ?? null,
            queueError: queueState?.error ?? null,
        };
    });
    res.json({ devices });
});

// ---------- HTTP API：读目录 ----------
app.get('/api/fs/dir', (req, res) => {
    const device = req.query.device as string;
    const virtualPath = (req.query.path as string) || '';

    if (!device || !virtualPath) {
        return res.status(400).json({ code: '400', message: '缺少 device 或 path' });
    }

    const parsed = parseVirtualPath(device, virtualPath);
    if ('error' in parsed) {
        return res.status(parsed.code).json({ code: String(parsed.code), message: parsed.error });
    }

    const meta = deviceNameToSocket.get(device);
    if (!meta) {
        return res.status(404).json({ code: '404', message: '设备未连接' });
    }
    console.log('parsed.devicePath', parsed.devicePath)
    emitWithAck<{ name: string; type: 'file' | 'dir' }[]>(meta.socket, 'read_dir', {
        payload: { path: parsed.devicePath },
    })
        .then((entries) => {
            res.json({ entries: Array.isArray(entries) ? entries : [] });
        })
        .catch((err) => {
            res.status(500).json({
                code: '500',
                message: err?.message || '读取目录失败',
            });
        });
});

// ---------- HTTP API：读文件 ----------
app.get('/api/fs/file', (req, res) => {
    const device = req.query.device as string;
    const virtualPath = (req.query.path as string) || '';

    if (!device || !virtualPath) {
        return res.status(400).json({ code: '400', message: '缺少 device 或 path' });
    }

    const parsed = parseVirtualPath(device, virtualPath);
    if ('error' in parsed) {
        return res.status(parsed.code).json({ code: String(parsed.code), message: parsed.error });
    }

    const meta = deviceNameToSocket.get(device);
    if (!meta) {
        return res.status(404).json({ code: '404', message: '设备未连接' });
    }

    emitWithAck<Buffer | string | null>(meta.socket, 'read_file', {
        payload: { path: parsed.devicePath },
    })
        .then((content) => {
            if (content == null) {
                return res.status(404).json({ code: '404', message: '文件不存在或读取失败' });
            }
            const buf = Buffer.isBuffer(content) ? content : Buffer.from(String(content), 'utf8');
            const filename = virtualPath.split('/').pop() || 'file';
            const ext = path.extname(filename).toLowerCase();
            const mime: Record<string, string> = {
                '.js': 'application/javascript',
                '.mjs': 'application/javascript',
                '.ts': 'application/typescript',
                '.json': 'application/json',
                '.html': 'text/html',
                '.txt': 'text/plain',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.webp': 'image/webp',
                '.gif': 'image/gif',
            };
            res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
            res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
            res.send(buf);
        })
        .catch((err) => {
            res.status(500).json({
                code: '500',
                message: err?.message || '读取文件失败',
            });
        });
});

// ---------- HTTP API：删除文件 ----------
app.delete('/api/fs/file', (req, res) => {
    const device = req.query.device as string;
    const virtualPath = (req.query.path as string) || '';

    if (!device || !virtualPath) {
        return res.status(400).json({ code: '400', message: '缺少 device 或 path' });
    }

    const parsed = parseVirtualPath(device, virtualPath);
    if ('error' in parsed) {
        return res.status(parsed.code).json({ code: String(parsed.code), message: parsed.error });
    }

    const meta = deviceNameToSocket.get(device);
    if (!meta) {
        return res.status(404).json({ code: '404', message: '设备未连接' });
    }

    emitWithAck<{ ok?: boolean }>(meta.socket, 'rm', {
        payload: { path: parsed.devicePath },
    })
        .then(() => {
            res.json({ ok: true, message: 'deleted' });
        })
        .catch((err) => {
            res.status(500).json({
                code: '500',
                message: err?.message || '删除失败',
            });
        });
});

// ---------- HTTP API：脚本队列 ----------
app.get('/api/scripts/queue', (req, res) => {
    const device = req.query.device as string;
    if (!device) {
        return res.status(400).json({ code: '400', message: '缺少 device' });
    }
    const meta = deviceNameToSocket.get(device);
    if (!meta) {
        return res.status(404).json({ code: '404', message: '设备未连接' });
    }
    const cached = deviceQueues.get(device);
    if (cached && Date.now() - cached.updatedAt < 2000 && cached.snapshot) {
        return res.json(cached.snapshot);
    }
    emitWithAck<ScriptQueueSnapshot>(meta.socket, 'script_queue', { payload: {} })
        .then((snapshot) => {
            deviceQueues.set(device, {
                snapshot,
                updatedAt: Date.now(),
            });
            res.json(snapshot);
        })
        .catch((err) => {
            deviceQueues.set(device, {
                snapshot: null,
                updatedAt: Date.now(),
                error: err?.message || '获取队列失败',
            });
            res.status(500).json({
                code: '500',
                message: err?.message || '获取队列失败',
            });
        });
});

// ---------- Socket.IO：设备连接时注册，断开时注销 ----------
io.on('connection', (socket) => {
    const deviceName =
        (socket.handshake.query?.deviceName as string)?.trim() ||
        (socket.handshake.auth as any)?.deviceName ||
        socket.id;
    registerDevice(deviceName, socket);
    console.log('device connected:', deviceName, socket.id);

    socket.on('disconnect', (reason) => {
        unregisterDevice(socket.id);
        console.log('device disconnected:', deviceName, reason);
    });

    for(let i = 0; i < 10; i++) {
        setTimeout(() => {
            socket.emit('exec_local_script', {
                payload: {
                    filename: 'queue.cjs',
                },
            }, res => {
                console.log('res', res)
            });
        }, i * 1000);
    }

});

server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
    console.log('browser UI: http://localhost:3000/browser');
});
