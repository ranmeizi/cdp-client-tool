const API_BASE = ''

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`
    try {
      const data = await res.json()
      if (data?.message) msg = data.message
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
  return res.json()
}

export async function getDevices(): Promise<{ devices: import('../types').Device[] }> {
  return fetchJSON(`${API_BASE}/api/devices`)
}

export async function getDir(device: string, path: string): Promise<{ entries: import('../types').DirEntry[] }> {
  const params = new URLSearchParams({ device, path })
  return fetchJSON(`${API_BASE}/api/fs/dir?${params}`)
}

export async function deleteFile(device: string, path: string): Promise<{ ok: boolean }> {
  const params = new URLSearchParams({ device, path })
  const res = await fetch(`${API_BASE}/api/fs/file?${params}`, { method: 'DELETE' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.message || res.statusText)
  }
  return res.json()
}

export async function interruptScript(device: string, jobId: string): Promise<{ ok: boolean }> {
  return fetchJSON(`${API_BASE}/api/scripts/interrupt`, {
    method: 'POST',
    body: JSON.stringify({ device, jobId }),
  })
}

export async function undoScript(device: string, jobId: string): Promise<{ ok: boolean }> {
  return fetchJSON(`${API_BASE}/api/scripts/undo`, {
    method: 'POST',
    body: JSON.stringify({ device, jobId }),
  })
}

export function getFileUrl(device: string, path: string): string {
  const params = new URLSearchParams({ device, path })
  return `${API_BASE}/api/fs/file?${params}`
}
