import React, { createContext, useContext, useCallback, useState, useEffect } from 'react'
import type { Device, DirEntry } from '../types'
import { getDevices } from '../api/client'

interface AppState {
  devices: Device[]
  currentDevice: string | null
  currentPath: string | null
  status: string
  statusLevel: 'info' | 'warn' | 'error'
}

interface AppContextValue extends AppState {
  setCurrentDevice: (name: string | null) => void
  setCurrentPath: (path: string | null) => void
  setStatus: (text: string, level?: 'info' | 'warn' | 'error') => void
  refreshDevices: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [devices, setDevices] = useState<Device[]>([])
  const [currentDevice, setCurrentDeviceState] = useState<string | null>(null)
  const [currentPath, setCurrentPathState] = useState<string | null>(null)
  const [status, setStatusText] = useState('已加载界面，等待选择设备…')
  const [statusLevel, setStatusLevel] = useState<'info' | 'warn' | 'error'>('info')

  const setStatus = useCallback((text: string, level: 'info' | 'warn' | 'error' = 'info') => {
    setStatusText(text)
    setStatusLevel(level)
  }, [])

  const setCurrentDevice = useCallback((name: string | null) => {
    setCurrentDeviceState(name)
    setCurrentPathState(null)
  }, [])

  const setCurrentPath = useCallback((path: string | null) => {
    setCurrentPathState(path)
  }, [])

  const refreshDevices = useCallback(async () => {
    try {
      setStatus('正在加载设备列表…')
      const data = await getDevices()
      setDevices(data.devices || [])
      setStatus('已刷新设备列表。')
    } catch (err) {
      setStatus('加载设备列表失败：' + (err instanceof Error ? err.message : String(err)), 'error')
    }
  }, [setStatus])

  useEffect(() => {
    refreshDevices()
  }, [refreshDevices])

  useEffect(() => {
    const timer = setInterval(refreshDevices, 1000)
    return () => clearInterval(timer)
  }, [refreshDevices])

  const value: AppContextValue = {
    devices,
    currentDevice,
    currentPath,
    status,
    statusLevel,
    setCurrentDevice,
    setCurrentPath,
    setStatus,
    refreshDevices,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
