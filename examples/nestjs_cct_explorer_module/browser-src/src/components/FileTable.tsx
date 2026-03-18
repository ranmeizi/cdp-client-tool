import { Folder, FileText, Image, FileCode, Trash2, ExternalLink } from 'lucide-react'
import type { DirEntry } from '../types'
import { deleteFile, getFileUrl } from '../api/client'
import { useApp } from '../context/AppContext'

function getFileIcon(entry: DirEntry) {
  if (entry.type === 'dir') return { Icon: Folder, cls: 'text-sky-400 bg-sky-500/12' }
  const lower = entry.name.toLowerCase()
  if (/\.(png|jpg|jpeg|webp)$/.test(lower)) return { Icon: Image, cls: 'text-emerald-400 bg-emerald-500/18' }
  if (/\.(js|mjs|ts|cjs)$/.test(lower)) return { Icon: FileCode, cls: 'text-amber-400 bg-amber-500/18' }
  return { Icon: FileText, cls: 'text-blue-300 bg-blue-500/18' }
}

interface FileTableProps {
  entries: DirEntry[]
  onOpenDir: (path: string) => void
  onRefresh: () => void
}

export function FileTable({ entries, onOpenDir, onRefresh }: FileTableProps) {
  const { currentDevice, currentPath, setStatus } = useApp()

  const handleDelete = async (path: string, name: string) => {
    if (!currentDevice || !confirm(`确定要删除文件 ${name} 吗？此操作不可恢复。`)) return
    try {
      setStatus(`正在删除文件 ${path} …`)
      await deleteFile(currentDevice, path)
      setStatus(`文件已删除：${path}`)
      onRefresh()
    } catch (err) {
      setStatus('删除文件失败：' + (err instanceof Error ? err.message : String(err)), 'error')
    }
  }

  const handleView = (path: string) => {
    if (!currentDevice) return
    window.open(getFileUrl(currentDevice, path), '_blank')
  }

  if (!currentDevice) return null

  return (
    <div className="flex-1 overflow-auto rounded-lg border border-slate-700/95 bg-slate-900/96">
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 z-10 bg-slate-900/98">
          <tr>
            <th className="w-[40%] px-2.5 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-slate-400">
              名称
            </th>
            <th className="w-[20%] px-2.5 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-slate-400">
              类型
            </th>
            <th className="w-[20%] px-2.5 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-slate-400">
              所属设备
            </th>
            <th className="w-[20%] px-2.5 py-1.5 text-right text-[11px] font-medium uppercase tracking-wider text-slate-400">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-2.5 py-3 text-slate-400">
                当前目录下没有文件或子目录。
              </td>
            </tr>
          ) : (
            entries.map((e) => {
              const path = currentPath
                ? `/${currentDevice}/${currentPath}/${e.name}`.replace(/\/+/g, '/')
                : `/${currentDevice}/${e.name}`
              const { Icon, cls } = getFileIcon(e)
              return (
                <tr
                  key={e.name}
                  className={`border-b border-slate-700/90 transition-colors hover:bg-slate-800/80 ${
                    e.type === 'dir' ? 'cursor-pointer' : ''
                  }`}
                  onClick={e.type === 'dir' ? () => onOpenDir(path) : undefined}
                >
                  <td className="px-2.5 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex h-4 w-4 items-center justify-center rounded ${cls}`}>
                        <Icon className="h-3 w-3" />
                      </span>
                      <div>
                        <div>{e.name}</div>
                        <div className="text-[11px] text-slate-400">{e.type === 'dir' ? '目录' : '文件'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2.5 py-1.5">{e.type === 'dir' ? '目录' : '文件'}</td>
                  <td className="px-2.5 py-1.5">{currentDevice}</td>
                  <td className="px-2.5 py-1.5">
                    {e.type === 'file' && (
                      <div className="flex justify-end gap-1.5" onClick={(ev) => ev.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleView(path)}
                          className="rounded-full px-1 py-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                          title="查看"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(path, e.name)}
                          className="rounded-full px-1 py-0.5 text-slate-400 hover:bg-red-500/12 hover:text-red-400"
                          title="删除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
