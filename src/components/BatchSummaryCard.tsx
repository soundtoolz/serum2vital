import { useState } from 'react'
import type { BatchSummary } from '../converter/types'

interface BatchSummaryCardProps {
  summary: BatchSummary
  onDownloadZip: (organizeByCategory: boolean) => void
  onClear: () => void
  isDownloadingZip: boolean
}

export function BatchSummaryCard({
  summary,
  onDownloadZip,
  onClear,
  isDownloadingZip,
}: BatchSummaryCardProps) {
  const [organize, setOrganize] = useState(false)

  const successfulTotal = summary.success + summary.warnings

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div>
          <h3 className="font-semibold text-slate-900 text-base tracking-tight">Conversion Summary</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Processed {summary.total} preset(s) in {(summary.totalDurationMs / 1000).toFixed(1)}s
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 transition-colors self-start sm:self-auto cursor-pointer border border-slate-200"
        >
          Clear Queue
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="text-[11px] text-slate-500">Total</div>
          <div className="text-sm font-semibold text-slate-900 mt-0.5 font-mono">{summary.total}</div>
        </div>
        <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200">
          <div className="text-[11px] text-emerald-800">Converted</div>
          <div className="text-sm font-semibold text-emerald-700 mt-0.5 font-mono">{summary.success}</div>
        </div>
        <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200">
          <div className="text-[11px] text-amber-800">Approximations</div>
          <div className="text-sm font-semibold text-amber-700 mt-0.5 font-mono">{summary.warnings}</div>
        </div>
        <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-200">
          <div className="text-[11px] text-rose-800">Failed</div>
          <div className="text-sm font-semibold text-rose-700 mt-0.5 font-mono">{summary.failed}</div>
        </div>
      </div>

      {/* ZIP Options and Download */}
      {successfulTotal > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {successfulTotal > 1 ? (
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={organize}
                onChange={(e) => setOrganize(e.target.checked)}
                className="accent-slate-900 w-3.5 h-3.5 rounded cursor-pointer"
              />
              <span>Organize ZIP by sound category (Bass, Lead, Pad, etc.)</span>
            </label>
          ) : (
            <span className="text-xs text-slate-500">
              Preset converted and ready to download
            </span>
          )}

          <button
            type="button"
            disabled={isDownloadingZip}
            onClick={() => onDownloadZip(organize)}
            className="py-2.5 px-4 rounded-lg font-medium text-white text-xs bg-slate-900 hover:bg-slate-800 flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50 shadow-xs sm:ml-auto"
          >
            {isDownloadingZip ? (
              <span>Preparing download...</span>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>
                  {successfulTotal === 1
                    ? 'Download Vital Preset'
                    : `Download All as ZIP (${successfulTotal})`}
                </span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
