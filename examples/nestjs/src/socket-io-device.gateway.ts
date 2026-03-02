import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import type {
  DeviceGateway,
  DeviceInfo,
  DirEntry,
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
}
