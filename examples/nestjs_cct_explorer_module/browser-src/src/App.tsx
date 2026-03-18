import { useEffect } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { DeviceList } from './components/DeviceList'
import { FileBrowser } from './components/FileBrowser'
import { ScriptQueue } from './components/ScriptQueue'
import { StatusBar } from './components/StatusBar'

function AppContent() {
  const { currentDevice, setCurrentDevice, setStatus, devices } = useApp()

  useEffect(() => {
    if (!currentDevice && devices.length > 0) {
      setCurrentDevice(devices[0].name)
      setStatus(`已加载设备列表，当前设备：${devices[0].name}`)
    } else if (devices.length === 0 && currentDevice) {
      setCurrentDevice(null)
      setStatus('暂无在线设备。', 'warn')
    }
  }, [devices, currentDevice, setCurrentDevice, setStatus])

  return (
    <div className="flex h-screen items-stretch justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-950 text-slate-200">
      <div className="mx-4 flex w-full max-w-[1320px] overflow-hidden rounded-2xl border border-slate-600/20 bg-slate-950 shadow-2xl">
        <aside className="flex w-[260px] flex-col border-r border-slate-700/90 bg-slate-950">
          <div className="border-b border-slate-700/70 px-4 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold tracking-wide">
              设备资源浏览器
              <span className="rounded-full border border-slate-500/50 px-2 py-0.5 text-[10px] uppercase text-slate-400">
                CDP CLIENT
              </span>
            </div>
            <div className="mt-1.5 text-xs text-slate-400">
              通过 socket.io 网关浏览各设备脚本与截图
            </div>
          </div>
          <DeviceList />
          <div className="mt-auto border-t border-slate-700/90 px-3.5 py-3 text-[11px] text-slate-400">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">
                {currentDevice ? `当前设备：${currentDevice}` : '未选择设备'}
              </span>
              <span className="shrink-0 rounded-full border border-slate-500/55 px-2 py-0.5 text-[10px] uppercase">
                SOCKET.IO
              </span>
            </div>
          </div>
        </aside>

        <main className="flex flex-1 flex-col bg-slate-950">
          <FileBrowser />
          <div className="border-t border-slate-700/90 p-2.5">
            <section className="rounded-xl border border-slate-700/90 bg-slate-900/50 p-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  脚本队列
                </span>
                <span className="text-xs text-slate-400">
                  {currentDevice ? '选择设备后每秒刷新' : '选择设备后每秒刷新'}
                </span>
              </div>
              <ScriptQueue />
            </section>
          </div>
          <div className="border-t border-slate-700/70 px-2.5 py-1">
            <StatusBar />
          </div>
        </main>
      </div>
    </div>
  )
}

export function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
