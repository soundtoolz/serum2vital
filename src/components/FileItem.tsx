import { useMemo } from 'react'
import type { QueueItem } from '../converter/types'
import { checkDependencyStatus } from '../utils/dependencies'
import { triggerFileDownload } from '../utils/download'

interface FileItemProps {
  item: QueueItem
  resources: Record<string, string>
  onDownload?: (item: QueueItem) => void
  onRemove: (id: string) => void
  isProcessing: boolean
}



export function FileItem({ item, resources, onRemove, isProcessing }: FileItemProps) {
  const isDone = item.status === 'success' || item.status === 'warning'

  const downloadFilename = useMemo(() => {
    let name = item.outputName || `${item.inputName.replace(/\.[^/.]+$/, '')}.vital`
    if (!name.toLowerCase().endsWith('.vital')) {
      name += '.vital'
    }
    return name.replace(/[/\\?%*:|"<>]/g, '_')
  }, [item.outputName, item.inputName])

  // Check dependencies
  const depStatus = useMemo(() => {
    if (!item.dependencies) return null
    return checkDependencyStatus(item.dependencies, resources)
  }, [item.dependencies, resources])

  const handleDownload = () => {
    if (!item.outputBytes) return
    triggerFileDownload(item.outputBytes, downloadFilename, 'application/octet-stream')
  }

  return (
    <div className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 transition-colors min-h-[58px]">
      {/* File Info */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200 flex-shrink-0 shadow-xs">
          {item.format === 'serum1' ? 'S1' : 'S2'}
        </span>

        <div className="min-w-0">
          <div className="font-medium text-slate-900 text-xs sm:text-sm truncate">
            {item.inputName}
          </div>

          {/* Dependency Status (When Waiting to Convert) */}
          {item.status === 'waiting' && depStatus && !depStatus.isReady && (
            <div className="mt-1">
              <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-md flex flex-wrap items-center gap-1.5 font-medium">
                <svg className="w-3.5 h-3.5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>
                  Missing {depStatus.missing.map((m) => `${m.type === 'wavetable' ? 'wavetable' : 'sample'} "${m.name}"`).join(', ')}
                </span>
              </div>
            </div>
          )}

          

          {item.status === 'failed' && item.errors && item.errors.length > 0 && (
            <div className="text-[11px] text-rose-600 font-mono mt-0.5 truncate" title={item.errors.join(' • ')}>
              {item.errors.join(' • ')}
            </div>
          )}
        </div>
      </div>

      {/* Status & Action */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {item.status === 'waiting' && !isProcessing && (
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label={`Remove ${item.inputName}`}
            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {item.status === 'converting' && (
          <span className="text-xs px-2.5 py-1 rounded-md bg-white text-slate-600 flex items-center gap-1.5 font-medium border border-slate-200 shadow-xs">
            <svg className="animate-spin w-3 h-3 text-slate-700" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Converting...</span>
          </span>
        )}

        {isDone && item.outputBytes && (
          <button
            type="button"
            onClick={handleDownload}
            aria-label={`Download ${downloadFilename}`}
            title={`Download ${downloadFilename}`}
            className="w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer shadow-xs flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        )}

        {item.status === 'failed' && (
          <span className="text-xs px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-medium border border-rose-200">
            Failed
          </span>
        )}
      </div>
    </div>
  )
}
