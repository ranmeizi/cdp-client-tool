export interface DeviceInfo {
  name: string;
  connectedAt?: string;
}

export interface DirEntry {
  name: string;
  type: 'file' | 'dir';
}

export interface DeviceGateway {
  listDevices(): Promise<DeviceInfo[]>;
  readDir(device: string, devicePath: string): Promise<DirEntry[]>;
  readFile(device: string, devicePath: string): Promise<Buffer>;
  removeFile(device: string, devicePath: string): Promise<void>;
  writeFile?(device: string, devicePath: string, content: Buffer | string): Promise<void>;
}
