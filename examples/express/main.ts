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

// ---------- 设备注册：deviceName <-> socket ----------
const deviceNameToSocket = new Map<string, { socket: Socket; connectedAt: string }>();
const socketIdToDeviceName = new Map<string, string>();

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

// ---------- 静态与页面 ----------
app.use('/static', express.static(join(__dirname, 'public')));
app.get('/browser', (req, res) => {
    res.sendFile(join(__dirname, 'public', 'browser.html'));
});

// ---------- HTTP API：设备列表 ----------
app.get('/api/devices', (req, res) => {
    const devices = Array.from(deviceNameToSocket.entries()).map(([name, meta]) => ({
        name,
        connectedAt: meta.connectedAt,
    }));
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

    setTimeout(() => {
        // 等一下初始化好
        socket.emit('exec_local_script', {
            payload: {
                filename: 'baidu_screenshot.cjs',
            },
        }, res => {
            console.log('res', res)
        });
    }, 5000);

});

server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
    console.log('browser UI: http://localhost:3000/browser');
});
