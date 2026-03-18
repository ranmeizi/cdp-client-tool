import { RefreshCw } from 'lucide-react'
import { useApp } from '../context/AppContext'

export function DeviceList() {
  const { devices, currentDevice, setCurrentDevice, setStatus, refreshDevices } = useApp()

  const handleSelect = (name: string) => {
    setCurrentDevice(name)
    setStatus(`已选择设备 ${name}，请选择目录。`)
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 text-[11px] text-slate-400 uppercase tracking-wider">
        <span>Devices</span>
        <button
          type="button"
          onClick={refreshDevices}
          className="inline-flex items-center gap-1 rounded-full px-1 py-0.5 text-[11px] text-slate-400 hover:bg-slate-900/80 hover:text-slate-200"
        >
          <RefreshCw className="h-3 w-3" />
          刷新
        </button>
      </div>
      <div className="flex-1 overflow-auto px-2 pb-2">
        {devices.length === 0 ? (
          <div className="px-2.5 py-2 text-xs text-slate-400">暂无在线设备</div>
        ) : (
          devices.map((d) => (
            <button
              key={d.name}
              type="button"
              onClick={() => handleSelect(d.name)}
              className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-all hover:bg-slate-900/80 ${
                currentDevice === d.name
                  ? 'bg-sky-500/10 shadow-[0_0_0_1px_rgba(56,189,248,0.3)]'
                  : ''
              }`}
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(34,197,94,0.15)]" />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium">{d.name}</div>
                <div className="text-[11px] text-slate-400">
                  {d.connectedAt ? new Date(d.connectedAt).toLocaleString() : '已连接'}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </>
  )
}
