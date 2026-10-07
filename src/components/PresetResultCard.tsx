import { useState } from 'react'
import type { ConversionResultPayload } from '../converter/messages'

interface PresetResultCardProps {
  result: ConversionResultPayload
  onDownload: () => void
}

export function PresetResultCard({ result, onDownload }: PresetResultCardProps) {
  const [showJson, setShowJson] = useState(false)

  return (
    <div className="bg-[#1a1d27] border border-[#22c55e]/40 rounded-2xl p-6 sm:p-8 flex flex-col gap-6 shadow-2xl shadow-black/50 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#22c55e]/15 border border-[#22c55e]/30 flex items-center justify-center text-[#22c55e] flex-shrink-0 shadow-lg shadow-[#22c55e]/10">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-white text-lg tracking-tight">{result.output_filename}</h3>
            <div className="text-xs text-[#94a3b8] flex items-center gap-2 mt-0.5">
              <span>{result.name || 'Serum Preset'}</span>
              {result.author && <span>• by {result.author}</span>}
            </div>
          </div>
        </div>

        {/* Category Badges */}
        <div className="flex gap-1.5 flex-wrap">
          {result.category.map((cat, idx) => (
            <span
              key={idx}
              className="px-2.5 py-1 rounded-lg text-xs bg-[#22263a] text-[#a78bfa] font-mono border border-[#2a2f45]"
            >
              {cat}
            </span>
          ))}
        </div>
      </div>

      {/* Synthesis Parameter Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#141721] p-3.5 rounded-xl border border-[#2a2f45]">
          <div className="text-[11px] text-[#64748b]">Engine Target</div>
          <div className="text-sm font-semibold text-white mt-0.5">Vital 1.5.5</div>
        </div>
        <div className="bg-[#141721] p-3.5 rounded-xl border border-[#2a2f45]">
          <div className="text-[11px] text-[#64748b]">Parameters</div>
          <div className="text-sm font-semibold text-[#22c55e] mt-0.5">781 Mapped</div>
        </div>
        <div className="bg-[#141721] p-3.5 rounded-xl border border-[#2a2f45]">
          <div className="text-[11px] text-[#64748b]">Approximations</div>
          <div className="text-sm font-semibold text-[#f59e0b] mt-0.5">{result.approximations.length}</div>
        </div>
        <div className="bg-[#141721] p-3.5 rounded-xl border border-[#2a2f45]">
          <div className="text-[11px] text-[#64748b]">Warnings</div>
          <div className="text-sm font-semibold text-[#94a3b8] mt-0.5">{result.warnings.length}</div>
        </div>
      </div>

      {/* Warnings & Approximations List */}
      {(result.warnings.length > 0 || result.approximations.length > 0 || result.unsupported.length > 0) && (
        <div className="bg-[#141721] p-4 rounded-xl border border-[#2a2f45] text-xs flex flex-col gap-2">
          <div className="text-[#94a3b8] font-medium">Conversion Report & Approximations:</div>
          <ul className="space-y-1 font-mono text-[11px] max-h-40 overflow-y-auto">
            {result.unsupported.map((note, i) => (
              <li key={`unsup-${i}`} className="text-[#ef4444] flex items-start gap-1.5">
                <span>✕</span> <span>{note}</span>
              </li>
            ))}
            {result.approximations.map((note, i) => (
              <li key={`app-${i}`} className="text-[#f59e0b] flex items-start gap-1.5">
                <span>⚠</span> <span>{note}</span>
              </li>
            ))}
            {result.warnings.map((note, i) => (
              <li key={`warn-${i}`} className="text-[#94a3b8] flex items-start gap-1.5">
                <span>ℹ</span> <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Download and JSON Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <button
          type="button"
          onClick={onDownload}
          aria-label={`Download ${result.output_filename}`}
          className="flex-1 py-3.5 px-6 rounded-xl font-bold text-white bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#16a34a] hover:to-[#15803d] shadow-lg shadow-[#22c55e]/25 text-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-[#22c55e]"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download {result.output_filename}
        </button>

        <button
          type="button"
          onClick={() => setShowJson(!showJson)}
          aria-label={showJson ? 'Hide preset JSON' : 'Inspect preset JSON'}
          className="py-3.5 px-5 rounded-xl border border-[#2a2f45] bg-[#22263a] hover:bg-[#2a2f45] text-xs font-mono text-[#cbd5e1] hover:text-white transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#7c5df9]"
        >
          {showJson ? 'Hide JSON' : 'Inspect JSON'}
        </button>
      </div>

      {/* Preset JSON Viewer */}
      {showJson && result.vital_json && (
        <pre className="bg-[#0f1117] p-4 rounded-xl border border-[#2a2f45] text-[11px] font-mono text-[#94a3b8] max-h-72 overflow-auto">
          {JSON.stringify(JSON.parse(result.vital_json), null, 2)}
        </pre>
      )}
    </div>
  )
}