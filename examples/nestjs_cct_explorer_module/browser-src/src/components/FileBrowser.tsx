import { RefreshCw } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useFileBrowser } from '../hooks/useFileBrowser'
import { FileTable } from './FileTable'

export function FileBrowser() {
  const { currentDevice, currentPath, setCurrentPath, setStatus } = useApp()
  const apiPath = currentPath ? `/${currentDevice}/${currentPath.replace(/^\/+/, '')}` : null
  const { entries, loading, refresh } = useFileBrowser(currentDevice, apiPath)

  /** 将完整路径转为相对路径（去掉 device 前缀），用于存储。仅允许 local_scripts/screenshots 及其子路径 */
  const toRelativePath = (fullPath: string): string | null => {
    const normalized = fullPath.replace(/^\/+/, '')
    if (!normalized.startsWith(currentDevice + '/')) return null
    const rel = normalized.slice(currentDevice.length + 1)
    if (!rel || rel === currentDevice) return null
    if (!['local_scripts', 'screenshots'].includes(rel.split('/')[0])) return null
    return rel
  }

  /** 将相对路径转为完整路径，用于 API 调用 */
  const toFullPath = (rel: string): string => `/${currentDevice}/${rel.replace(/^\/+/, '')}`

  const handleOpenDir = (fullPath: string) => {
    if (!currentDevice) return
    const rel = toRelativePath(fullPath)
    setCurrentPath(rel ?? null)
    setStatus(`正在读取目录 ${fullPath} …`)
  }

  const handleRootLocal = () => {
    if (!currentDevice) {
      setStatus('请先选择设备。', 'warn')
      return
    }
    handleOpenDir(`/${currentDevice}/local_scripts`)
  }

  const handleRootScreenshots = () => {
    if (!currentDevice) {
      setStatus('请先选择设备。', 'warn')
      return
    }
    handleOpenDir(`/${currentDevice}/screenshots`)
  }

  const handleRefresh = () => {
    if (currentPath) {
      handleOpenDir(toFullPath(currentPath))
    } else if (currentDevice) {
      setCurrentPath(null)
    } else {
      setStatus('请先选择设备。', 'warn')
    }
  }

  const renderBreadcrumbs = () => {
    if (!currentDevice) {
      return <span className="text-xs text-slate-400">请选择左侧设备</span>
    }
    if (currentPath === null || currentPath === '') {
      return (
        <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-sky-400">/{currentDevice}</span>
      )
    }
    // currentPath 为相对路径，如 "screenshots" 或 "screenshots/2024"，不含 device
    const pathParts = currentPath.split('/').filter(Boolean)
    const segments: { name: string; relPath: string }[] = []
    for (let i = 0; i < pathParts.length; i++) {
      segments.push({
        name: pathParts[i],
        relPath: pathParts.slice(0, i + 1).join('/'),
      })
    }
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
        <button
          type="button"
          onClick={() => setCurrentPath(null)}
          className="rounded-full px-2 py-0.5 hover:bg-slate-800 hover:text-slate-200"
        >
          /{currentDevice}
        </button>
        {segments.map((seg, idx) => {
          const isLast = idx === segments.length - 1
          return (
            <span key={seg.relPath} className="flex items-center gap-1.5">
              <span className="opacity-40">&gt;</span>
              <button
                type="button"
                onClick={() => handleOpenDir(toFullPath(seg.relPath))}
                className={`rounded-full px-2 py-0.5 ${
                  isLast ? 'bg-sky-500/10 text-sky-400' : 'hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                /{seg.name}
              </button>
            </span>
          )
        })}
      </div>
    )
  }

  const panelSubtitle =
    currentDevice && (currentPath === null || currentPath === '')
      ? `根目录：/${currentDevice}，选择 local_scripts 或 screenshots`
      : currentPath
        ? `目录：/${currentDevice}/${currentPath}`
        : ''

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-slate-700/70 px-4 py-3">
        {renderBreadcrumbs()}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleRootLocal}
            className="rounded-full border border-slate-500/50 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            local_scripts
          </button>
          <button
            type="button"
            onClick={handleRootScreenshots}
            className="rounded-full border border-slate-500/50 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            screenshots
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/70 bg-sky-500/10 px-2.5 py-1 text-[11px] text-sky-400 hover:bg-sky-500/20"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            刷新目录
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-2.5">
        <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-700/90 bg-slate-900/50 p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              当前目录
            </span>
            <span className="text-xs text-slate-400">{panelSubtitle}</span>
          </div>
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-slate-400">加载中…</div>
          ) : (
            <FileTable entries={entries} onOpenDir={handleOpenDir} onRefresh={refresh} />
          )}
        </section>
      </div>
    </div>
  )
}
