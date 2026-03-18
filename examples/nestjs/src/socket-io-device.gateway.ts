import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import type {
  DeviceGateway,
  DeviceInfo,
  DirEntry,
  ScriptQueueSnapshot,
} from '@bomon/nestjs-cct-explorer';

const SOCKET_ACK_TIMEOUT_MS = 15000;

@Injectable()
export class SocketIoDeviceGateway implements DeviceGateway {
  private io: Server | null = null;
  private readonly deviceNameToSocket = new Map<
    string,
    { socket: Socket; connectedAt: string }
  >();
  private readonly socketIdToDeviceName = new Map<string, string>();

  setIo(io: Server): void {
    this.io = io;
    io.on('connection', (socket: Socket) => {
      const deviceName =
        (socket.handshake.query?.deviceName as string)?.trim() ||
        (socket.handshake.auth as { deviceName?: string })?.deviceName ||
        socket.id;
      this.registerDevice(deviceName, socket);
      console.log('device connected:', deviceName, socket.id);

      socket.on('disconnect', (reason: string) => {
        this.unregisterDevice(socket.id);
        console.log('device disconnected:', deviceName, reason);
      });

      // 测试：设备连接后每秒下发一次 queue.cjs，共 10 次
      // for (let i = 0; i < 5; i++) {
      //   setTimeout(() => {
      //     socket.emit(
      //       'exec_local_script',
      //       { payload: { filename: 'queue.cjs' } },
      //       (res: unknown) => {
      //         console.log('exec_local_script res', res);
      //       },
      //     );
      //   }, i * 1000);
      // }

      socket.emit(
        'exec_local_script',
        { payload: { filename: 'baidu_screenshot.cjs' } },
        (res: unknown) => {
          console.log('exec_local_script res', res);
        })
    });
  }

  private registerDevice(deviceName: string, socket: Socket): void {
    const existing = this.deviceNameToSocket.get(deviceName);
    if (existing) existing.socket.disconnect(true);
    this.deviceNameToSocket.set(deviceName, {
      socket,
      connectedAt: new Date().toISOString(),
    });
    this.socketIdToDeviceName.set(socket.id, deviceName);
  }

  private unregisterDevice(socketId: string): void {
    const name = this.socketIdToDeviceName.get(socketId);
    if (name) {
      this.deviceNameToSocket.delete(name);
      this.socketIdToDeviceName.delete(socketId);
    }
  }

  private getSocket(device: string): Socket {
    const meta = this.deviceNameToSocket.get(device);
    if (!meta) throw new Error('设备未连接');
    return meta.socket;
  }

  private emitWithAck<T>(
    socket: Socket,
    event: string,
    payload: { payload: Record<string, unknown> },
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

  async listDevices(): Promise<DeviceInfo[]> {
    return Array.from(this.deviceNameToSocket.entries()).map(
      ([name, meta]) => ({
        name,
        connectedAt: meta.connectedAt,
      }),
    );
  }

  async readDir(device: string, devicePath: string): Promise<DirEntry[]> {
    const socket = this.getSocket(device);
    const entries = await this.emitWithAck<DirEntry[]>(socket, 'read_dir', {
      payload: { path: devicePath },
    });
    return Array.isArray(entries) ? entries : [];
  }

  async readFile(device: string, devicePath: string): Promise<Buffer> {
    const socket = this.getSocket(device);
    const content = await this.emitWithAck<Buffer | string | null>(
      socket,
      'read_file',
      { payload: { path: devicePath } },
    );
    if (content == null) throw new Error('file_not_found');
    return Buffer.isBuffer(content)
      ? content
      : Buffer.from(String(content), 'utf8');
  }

  async removeFile(device: string, devicePath: string): Promise<void> {
    const socket = this.getSocket(device);
    await this.emitWithAck(socket, 'rm', { payload: { path: devicePath } });
  }

  async writeFile(
    device: string,
    devicePath: string,
    content: Buffer | string,
  ): Promise<void> {
    const socket = this.getSocket(device);
    await this.emitWithAck(socket, 'set_file', {
      payload: { filename: devicePath, content },
    });
  }

  async getScriptQueue(device: string): Promise<ScriptQueueSnapshot> {
    const socket = this.getSocket(device);
    const snapshot = await this.emitWithAck<ScriptQueueSnapshot>(socket, 'script_queue', {
      payload: {},
    });
    return snapshot;
  }

  async interruptScript(
    device: string,
    jobId: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    const socket = this.getSocket(device);
    return this.emitWithAck(socket, 'interrupt_script', { payload: { jobId } });
  }

  async undoScript(
    device: string,
    jobId: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    const socket = this.getSocket(device);
    return this.emitWithAck(socket, 'undo_script', { payload: { jobId } });
  }
}
