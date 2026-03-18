import { useState, useCallback, useEffect, useRef } from 'react'
import type { DirEntry } from '../types'
import { getDir } from '../api/client'
import { useApp } from '../context/AppContext'

export function useFileBrowser(device: string | null, currentPath: string | null) {
  const { setStatus } = useApp()
  const [entries, setEntries] = useState<DirEntry[]>([])
  const [loading, setLoading] = useState(false)
  const lastPathRef = useRef<string | null>(null)

  const loadDir = useCallback(
    async (path: string) => {
      if (!device) return
      lastPathRef.current = path
      setLoading(true)
      try {
        const data = await getDir(device, path)
        if (lastPathRef.current !== path) return
        setEntries(data.entries || [])
        setStatus('目录加载完成：' + path)
      } catch (err) {
        if (lastPathRef.current !== path) return
        setStatus('读取目录失败：' + (err instanceof Error ? err.message : String(err)), 'error')
      } finally {
        if (lastPathRef.current === path) setLoading(false)
      }
    },
    [device, setStatus]
  )

  useEffect(() => {
    if (!device) {
      setEntries([])
      lastPathRef.current = null
      return
    }
    if (currentPath === null) {
      lastPathRef.current = null
      setEntries([
        { name: 'local_scripts', type: 'dir' },
        { name: 'screenshots', type: 'dir' },
      ])
      return
    }
    lastPathRef.current = currentPath
    void loadDir(currentPath)
  }, [device, currentPath, loadDir])

  return { entries, loading, refresh: () => currentPath && loadDir(currentPath) }
}
