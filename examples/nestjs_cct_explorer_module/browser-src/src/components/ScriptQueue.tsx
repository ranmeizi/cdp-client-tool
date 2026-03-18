import { Square, Undo2 } from 'lucide-react'
import type { ScriptJob } from '../types'
import { interruptScript, undoScript } from '../api/client'
import { useApp } from '../context/AppContext'

function formatElapsed(startedAt?: number): string {
  if (!startedAt) return ''
  const s = Math.floor((Date.now() - startedAt) / 1000)
  if (s < 60) return `${s} 秒`
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m} 分 ${r} 秒`
}

function jobLabel(job: ScriptJob): string {
  return job.filename || job.description || job.id || job.type || 'unknown'
}

function JobParamsTooltip({ job }: { job: ScriptJob }) {
  const params = job.params
  if (!params || (typeof params === 'object' && Object.keys(params).length === 0)) return null
  const str = typeof params === 'object' ? JSON.stringify(params, null, 2) : String(params)
  return (
    <span className="pointer-events-none absolute bottom-full left-0 z-[1000] mb-1 max-h-[200px] max-w-[320px] overflow-auto whitespace-pre-wrap rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-[11px] font-mono opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
      params:
      {str}
    </span>
  )
}

export function ScriptQueue() {
  const { currentDevice, devices, setStatus } = useApp()

  const meta = devices.find((d) => d.name === currentDevice)
  const data = meta?.scriptQueue

  if (!currentDevice) {
    return (
      <div className="min-h-[48px] text-xs text-slate-400">未选择设备</div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-[48px] text-xs text-slate-400">
        暂无脚本队列信息（等待服务端刷新）
        {meta?.queueError && <span className="ml-1">· 上次刷新失败：{meta.queueError}</span>}
      </div>
    )
  }

  const cap = data.capacity ?? 10
  const running = data.running ?? null
  const pending = data.pending ?? []
  const total = (running ? 1 : 0) + pending.length

  const handleInterrupt = async (jobId: string) => {
    if (!currentDevice) return
    if (!confirm('确定要中断当前正在运行的脚本吗？')) return
    try {
      setStatus(`正在中断脚本 ${jobId} …`)
      const res = await interruptScript(currentDevice, jobId)
      if (res.ok) {
        setStatus(`已中断脚本：${jobId}，队列下一任务将自动执行`)
      } else {
        setStatus('中断失败', 'error')
      }
    } catch (err) {
      setStatus('中断失败：' + (err instanceof Error ? err.message : String(err)), 'error')
    }
  }

  const handleUndo = async (jobId: string) => {
    if (!currentDevice) return
    if (!confirm('确定要撤销该排队任务吗？')) return
    try {
      setStatus(`正在撤销任务 ${jobId} …`)
      const res = await undoScript(currentDevice, jobId)
      if (res.ok) {
        setStatus(`已撤销任务：${jobId}`)
      } else {
        setStatus('撤销失败', 'error')
      }
    } catch (err) {
      setStatus('撤销失败：' + (err instanceof Error ? err.message : String(err)), 'error')
    }
  }

  return (
    <div className="space-y-1.5 text-xs">
      <div className="text-slate-400">
        {total} / {cap} 占用
      </div>
      {running ? (
        <div className="group relative flex flex-wrap items-center gap-2">
          <JobParamsTooltip job={running} />
          <span className="text-sky-400">▶ 运行中</span>
          <span>{jobLabel(running)}</span>
          {running.params && Object.keys(running.params).length > 0 && (
            <span className="cursor-help border-b border-dotted border-slate-400 text-[10px] opacity-70">
              📋 悬停查看 params
            </span>
          )}
          {running.startedAt && (
            <span className="text-slate-400">已运行 {formatElapsed(running.startedAt)}</span>
          )}
          <button
            type="button"
            onClick={() => handleInterrupt(running.id)}
            className="ml-auto shrink-0 rounded-full border border-red-500/50 bg-red-500/12 px-2 py-0.5 text-[10px] text-red-400 hover:bg-red-500/25"
            title="中断执行"
          >
            <Square className="mr-1 inline h-3 w-3" />
            中断
          </button>
        </div>
      ) : (
        <div className="text-slate-400">无运行中脚本</div>
      )}
      {pending.length > 0 ? (
        <>
          <div className="text-slate-400">排队中 ({pending.length})：</div>
          {pending.map((j, i) => (
            <div key={j.id} className="group relative flex flex-wrap items-center gap-2 pl-2">
              <JobParamsTooltip job={j} />
              <span className="flex-1 min-w-0">
                {i + 1}. {jobLabel(j)}
              </span>
              {j.params && Object.keys(j.params).length > 0 && (
                <span className="cursor-help border-b border-dotted border-slate-400 text-[10px] opacity-70">
                  📋 悬停查看 params
                </span>
              )}
              <button
                type="button"
                onClick={() => handleUndo(j.id)}
                className="ml-auto shrink-0 rounded-full border border-amber-500/50 bg-amber-500/12 px-2 py-0.5 text-[10px] text-amber-400 hover:bg-amber-500/25"
                title="撤销排队"
              >
                <Undo2 className="mr-1 inline h-3 w-3" />
                撤销
              </button>
            </div>
          ))}
        </>
      ) : (
        <div className="text-slate-400">无排队任务</div>
      )}
    </div>
  )
}
