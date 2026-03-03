export interface DeviceInfo {
  name: string;
  connectedAt?: string;
}

export interface DirEntry {
  name: string;
  type: 'file' | 'dir';
}

export interface ScriptJob {
  id: string;
  type: 'local' | 'remote';
  filename?: string;
  description?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  status: 'pending' | 'running' | 'success' | 'failed';
  errorMessage?: string;
}

export interface ScriptQueueSnapshot {
  running: ScriptJob | null;
  pending: ScriptJob[];
  capacity: number;
}

export interface DeviceGateway {
  listDevices(): Promise<DeviceInfo[]>;
  readDir(device: string, devicePath: string): Promise<DirEntry[]>;
  readFile(device: string, devicePath: string): Promise<Buffer>;
  removeFile(device: string, devicePath: string): Promise<void>;
  writeFile?(device: string, devicePath: string, content: Buffer | string): Promise<void>;
  getScriptQueue?(device: string): Promise<ScriptQueueSnapshot>;
}
