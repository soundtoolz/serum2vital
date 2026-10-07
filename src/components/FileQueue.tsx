import { useState, useMemo } from 'react'
import type { QueueItem } from '../converter/types'
import { FileItem } from './FileItem'
import { checkDependencyStatus } from '../utils/dependencies'

interface FileQueueProps {
  queue: QueueItem[]
  resources: Record<string, string>
  onResourcesChange?: (resources: Record<string, string>) => void
  onDownloadItem: (item: QueueItem) => void
  onRemoveItem: (id: string) => void
  onClearQueue: () => void
  onAddMoreFiles?: () => void
  onConvertAll: () => void
  onCancel: () => void
  isProcessing: boolean
  canConvert: boolean
}

export function FileQueue({
  queue,
  resources,
  onResourcesChange,
  onDownloadItem,
  onRemoveItem,
  onClearQueue,
  onConvertAll,
  onCancel,
  isProcessing,
  canConvert,
}: FileQueueProps) {
  const [activeTab, setActiveTab] = useState<'presets' | 'wavs'>('presets')
  const isEmpty = queue.length === 0
  const waitingCount = queue.filter((i) => i.status === 'waiting').length

  // Extract unique loaded .wav audio file names
  const wavFileNames = useMemo(() => {
    const seen = new Set<string>()
    const list: string[] = []
    for (const key of Object.keys(resources)) {
      if (key.toLowerCase().endsWith('.wav')) {
        const lower = key.toLowerCase()
        if (!seen.has(lower)) {
          seen.add(lower)
          list.push(key)
        }
      }
    }
    return list.sort((a, b) => a.localeCompare(b))
  }, [resources])

  const handleRemoveWav = (name: string) => {
    const lower = name.toLowerCase()
    const baseName = name.replace(/\.wav$/i, '')
    const lowerBase = baseName.toLowerCase()

    const updated = { ...resources }
    delete updated[name]
    delete updated[lower]
    delete updated[baseName]
    delete updated[lowerBase]
    delete updated[`${lowerBase}.wav`]
    delete updated[`${baseName}.wav`]
    onResourcesChange?.(updated)
  }

  const handleClearAllWavs = () => {
    onResourcesChange?.({})
  }

  // Check if any waiting item has missing audio files
  const { hasMissing, missingCount } = useMemo(() => {
    let missingCount = 0
    const missingNames = new Set<string>()

    for (const item of queue) {
      if (item.status === 'waiting' && item.dependencies) {
        const res = checkDependencyStatus(item.dependencies, resources)
        if (!res.isReady) {
          missingCount++
          res.missing.forEach((m) => missingNames.add(m.name))
        }
      }
    }

    return {
      hasMissing: missingCount > 0,
      missingCount,
      missingNames: Array.from(missingNames),
    }
  }, [queue, resources])

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col gap-3.5 shadow-xs">
      {/* Header Tabs */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`px-6 py-2.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
              activeTab === 'presets'
                ? 'bg-white text-slate-900 shadow-xs border-slate-200/60'
                : 'text-slate-500 hover:text-slate-800 border-transparent'
            }`}
          >
            <span>Presets</span>
            <span
              className={`text-xs font-mono px-2 py-0.5 rounded ${
                activeTab === 'presets'
                  ? 'bg-slate-100 text-slate-700 font-bold'
                  : 'bg-slate-200/70 text-slate-600'
              }`}
            >
              {queue.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('wavs')}
            className={`px-6 py-2.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
              activeTab === 'wavs'
                ? 'bg-white text-slate-900 shadow-xs border-slate-200/60'
                : 'text-slate-500 hover:text-slate-800 border-transparent'
            }`}
          >
            <span>Wav</span>
            <span
              className={`text-xs font-mono px-2 py-0.5 rounded ${
                activeTab === 'wavs'
                  ? 'bg-slate-100 text-slate-700 font-bold'
                  : 'bg-slate-200/70 text-slate-600'
              }`}
            >
              {wavFileNames.length}
            </span>
          </button>
        </div>

        {/* Clear All action */}
        {!isProcessing && (
          activeTab === 'presets' ? (
            !isEmpty && (
              <button
                type="button"
                onClick={onClearQueue}
                className="px-6 py-2.5 rounded-lg text-xs sm:text-sm font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50/70 border border-transparent hover:border-rose-200/60 transition-all cursor-pointer"
              >
                Clear All
              </button>
            )
          ) : (
            wavFileNames.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllWavs}
                className="px-6 py-2.5 rounded-lg text-xs sm:text-sm font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50/70 border border-transparent hover:border-rose-200/60 transition-all cursor-pointer"
              >
                Clear All
              </button>
            )
          )
        )}
      </div>

      {/* Tab Panels: CSS Grid overlay ensures height matches max(presetsHeight, wavsHeight) */}
      <div className="grid grid-cols-1 min-w-0">
        {/* Tab 1: Presets Content */}
        <div
          className={`col-start-1 row-start-1 min-w-0 flex flex-col justify-between gap-3.5 h-full ${
            activeTab === 'presets' ? 'visible relative z-10' : 'invisible pointer-events-none -z-10'
          }`}
          aria-hidden={activeTab !== 'presets'}
        >
          <div className="flex flex-col gap-3.5 flex-1 min-w-0">
            {/* Missing Dependencies Warning Banner */}
            {hasMissing && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 animate-fadeIn">
                <svg
                  className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-amber-950">
                    {missingCount} preset{missingCount > 1 ? 's' : ''} reference custom .wav files not loaded:
                  </span>
                  <span className="text-amber-800">
                    You can drop your .wav files or folder into the <strong>Drop wavetables & noises</strong> box above, or convert now using Vital's clean default waveforms.
                  </span>
                </div>
              </div>
            )}

            {/* Preset List / Empty State */}
            {isEmpty ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8 sm:py-10 px-4 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 min-h-[160px]">
                <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-400 mb-2.5">
                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <p className="text-xs sm:text-sm font-medium text-slate-700">No presets selected</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">
                  Choose or drop .fxp or .SerumPreset files into the box above to queue them for conversion.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto [scrollbar-gutter:stable] pr-0.5">
                {queue.map((item) => (
                  <FileItem
                    key={item.id}
                    item={item}
                    resources={resources}
                    onDownload={onDownloadItem}
                    onRemove={onRemoveItem}
                    isProcessing={isProcessing}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Convert / Action Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <span className="text-xs text-slate-500 self-start sm:self-auto">
              {isEmpty
                ? 'No presets in queue.'
                : isProcessing
                ? 'Converting presets...'
                : waitingCount > 0
                ? `${queue.length} preset${queue.length > 1 ? 's' : ''} ready to convert.`
                : (
                  <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    All presets converted successfully
                  </span>
                )}
            </span>

            {isProcessing ? (
              <button
                type="button"
                onClick={onCancel}
                className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer sm:ml-auto"
              >
                Cancel Conversion
              </button>
            ) : waitingCount > 0 ? (
              <button
                type="button"
                disabled={!canConvert}
                onClick={onConvertAll}
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 shadow-xs sm:ml-auto"
              >
                Convert
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-xs sm:text-sm font-semibold text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed shadow-none sm:ml-auto"
              >
                Convert
              </button>
            )}
          </div>
        </div>

        {/* Tab 2: Wavetables & Noises Content */}
        <div
          className={`col-start-1 row-start-1 min-w-0 flex flex-col justify-between gap-3.5 h-full ${
            activeTab === 'wavs' ? 'visible relative z-10' : 'invisible pointer-events-none -z-10'
          }`}
          aria-hidden={activeTab !== 'wavs'}
        >
          <div className="flex flex-col gap-3.5 flex-1 min-w-0">
            {wavFileNames.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8 sm:py-10 px-4 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 min-h-[160px]">
                <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-400 mb-2.5">
                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <p className="text-xs sm:text-sm font-medium text-slate-700">No wavetables or noises selected yet</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">
                  Drop or choose .wav audio files in the "Drop wavetables & noises" box above to embed them into converted Vital presets.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto [scrollbar-gutter:stable] pr-0.5">
                {wavFileNames.map((name) => (
                  <div
                    key={name}
                    className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 transition-colors min-h-[58px]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200 flex-shrink-0 shadow-xs">
                        WAV
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 text-xs sm:text-sm truncate" title={name}>
                          {name}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRemoveWav(name)}
                        aria-label={`Remove ${name}`}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer flex-shrink-0"
                        title={`Remove ${name}`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Row for Wavetables Tab */}
          <div className="flex items-center justify-between gap-3 pt-1 min-h-[40px]">
            <span className="text-xs text-slate-500">
              {wavFileNames.length > 0
                ? `${wavFileNames.length} audio file${wavFileNames.length > 1 ? 's' : ''} loaded for preset embedding.`
                : 'Custom audio files are optional.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
