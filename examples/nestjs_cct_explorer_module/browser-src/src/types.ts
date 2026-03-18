export interface Device {
  name: string
  connectedAt?: string
  scriptQueue?: ScriptQueueData
  queueUpdatedAt?: string
  queueError?: string
}

export interface ScriptQueueData {
  running: ScriptJob | null
  pending: ScriptJob[]
  capacity: number
}

export interface ScriptJob {
  id: string
  type?: 'local' | 'remote'
  filename?: string
  description?: string
  params?: Record<string, unknown>
  startedAt?: number
}

export interface DirEntry {
  name: string
  type: 'file' | 'dir'
}
