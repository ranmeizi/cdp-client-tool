import { useApp } from '../context/AppContext'

export function StatusBar() {
  const { status, statusLevel } = useApp()

  const dotCls =
    statusLevel === 'error'
      ? 'bg-red-500'
      : statusLevel === 'warn'
        ? 'bg-amber-500'
        : 'bg-emerald-500'

  return (
    <div className="flex items-center justify-between gap-2 px-0.5 py-0.5 text-[11px] text-slate-400">
      <div className="flex items-center gap-2 rounded-full border border-slate-700/90 bg-slate-900/98 px-2 py-1">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotCls}`} />
        <span>状态</span>
        <span className="max-w-[280px] truncate">{status}</span>
      </div>
      <div className="flex gap-1.5">
        <span className="rounded-full border border-slate-600 bg-slate-900/90 px-1.5 py-0.5 text-[10px]">
          GET /api/devices
        </span>
        <span className="rounded-full border border-slate-600 bg-slate-900/90 px-1.5 py-0.5 text-[10px]">
          GET /api/fs/dir
        </span>
        <span className="rounded-full border border-slate-600 bg-slate-900/90 px-1.5 py-0.5 text-[10px]">
          GET /api/fs/file
        </span>
        <span className="rounded-full border border-slate-600 bg-slate-900/90 px-1.5 py-0.5 text-[10px]">
          DELETE /api/fs/file
        </span>
      </div>
    </div>
  )
}
