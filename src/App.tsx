import { useState, useEffect, useRef } from 'react'
import { Header } from './components/Header'
import { DropZone } from './components/DropZone'
import { ResourceDropZone } from './components/ResourceDropZone'
import { inspectPresetDependencies } from './utils/dependencies'
import { FileQueue } from './components/FileQueue'
import { BatchSummaryCard } from './components/BatchSummaryCard'
import { ConversionSettings } from './components/ConversionSettings'
import { AboutModal } from './components/AboutModal'
import { converterClient } from './pyodide/converterClient'
import { deduplicateOutputNames } from './utils/naming'
import { detectFormat } from './utils/format'
import { createPresetsZip } from './utils/zip'
import { triggerFileDownload, embedTimestampFilename } from './utils/download'
import type {
  AppState,
  BatchSummary,
  QueueItem,
} from './converter/types'
import type {
  ConversionOptions,
  WorkerState,
} from './converter/messages'

export default function App() {
  const [appState, setAppState] = useState<AppState>('INITIALIZING')
  const [engineMessage, setEngineMessage] = useState('Initializing runtime...')
  const [runtimeVisible, setRuntimeVisible] = useState(true)
  const [runtimeExiting, setRuntimeExiting] = useState(false)
  const [notifications, setNotifications] = useState<
    Array<{ id: string; type: 'info' | 'warning' | 'error'; text: string; isExiting?: boolean }>
  >([])

  const handleAddNotification = (notice: { type: 'info' | 'warning'; text: string } | null) => {
    if (!notice) return
    const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const newNotice = { id, type: notice.type, text: notice.text, isExiting: false }

    setNotifications((prev) => [...prev, newNotice])

    // Auto-dismiss with smooth fade out after 10 seconds
    setTimeout(() => {
      handleRemoveNotification(id)
    }, 10000)
  }

  const handleRemoveNotification = (id: string) => {
    // Trigger fade-out animation first
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isExiting: true } : item))
    )

    // Unmount from DOM after animation completes (250ms)
    setTimeout(() => {
      setNotifications((prev) => prev.filter((item) => item.id !== id))
    }, 250)
  }
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [resources, setResources] = useState<Record<string, string>>({})
  const [batchSummary, setBatchSummary] = useState<BatchSummary | null>(null)
  const [isDownloadingZip, setIsDownloadingZip] = useState(false)
  const isCancelledRef = useRef(false)
  const addFilesInputRef = useRef<HTMLInputElement>(null)

  // Modals & Settings
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const [options, setOptions] = useState<ConversionOptions>({
    max_frames: 64,
    max_sample_seconds: 4.0,
    include_wavetables: true,
    include_samples: true,
  })

  // Global Engine Status Subscription
  useEffect(() => {
    const unsubStatus = converterClient.subscribeStatus((state: WorkerState, message: string) => {
      setEngineMessage(message)
      if (state === 'READY') {
        setAppState((prev) => (prev === 'INITIALIZING' ? 'READY' : prev))
        setRuntimeExiting(true)
        setTimeout(() => setRuntimeVisible(false), 250)
      } else if (state === 'ERROR') {
        setAppState('ERROR')
        setRuntimeVisible(true)
        setRuntimeExiting(false)
      }
    })

    converterClient.init()
    return unsubStatus
  }, [])

  // Add files to queue with dependency inspection
  const addFilesToQueue = async (newFiles: { name: string; bytes: ArrayBuffer }[]) => {
    setBatchSummary(null)

    const inspectedItems: QueueItem[] = []
    for (const f of newFiles) {
      const fmt = detectFormat(f.name, f.bytes ? new Uint8Array(f.bytes) : undefined)
      const isS2 = fmt === 'serum2'
      let deps = undefined
      try {
        deps = await inspectPresetDependencies(f.bytes, f.name)
      } catch (err) {
        console.warn('Failed to inspect dependencies for', f.name, err)
      }

      inspectedItems.push({
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        inputName: f.name,
        outputName: '',
        bytes: f.bytes,
        format: (isS2 ? 'serum2' : 'serum1') as 'serum1' | 'serum2',
        status: 'waiting' as const,
        warnings: [],
        approximations: [],
        unsupported: [],
        errors: [],
        dependencies: deps,
      })
    }

    setQueue((prevQueue) => {
      const combined = [...prevQueue, ...inspectedItems]
      const nameMap = deduplicateOutputNames(combined.map((c) => ({ id: c.id, name: c.inputName })))
      return combined.map((item) => ({
        ...item,
        outputName: nameMap.get(item.id) || `${item.inputName}.vital`,
      }))
    })
  }

  // Handle multiple files chosen from "+ Add More" input
  const handleMultiFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const readFiles: { name: string; bytes: ArrayBuffer }[] = []
    let readCount = 0

    for (const file of files) {
      const ext = file.name.toLowerCase()
      if (!ext.endsWith('.fxp') && !ext.endsWith('.serumpreset') && !ext.endsWith('.serum_preset')) {
        continue
      }
      const reader = new FileReader()
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          readFiles.push({ name: file.name, bytes: reader.result })
        }
        readCount++
        if (readCount === files.length) {
          addFilesToQueue(readFiles)
        }
      }
      reader.readAsArrayBuffer(file)
    }
  }

  // Convert all waiting items in queue
  const handleConvertAll = async () => {
    if (queue.length === 0 || appState === 'PROCESSING') return

    setAppState('PROCESSING')
    isCancelledRef.current = false
    const startTime = Date.now()

    let successCount = 0
    let warningCount = 0
    let failedCount = 0
    let cancelledCount = 0

    const currentQueue = [...queue]

    for (let i = 0; i < currentQueue.length; i++) {
      const currentItem = currentQueue[i]

      if (currentItem.status === 'success' || currentItem.status === 'warning') {
        if (currentItem.status === 'success') successCount++
        else warningCount++
        continue
      }

      if (isCancelledRef.current) {
        cancelledCount++
        setQueue((prev) =>
          prev.map((item) => (item.id === currentItem.id ? { ...item, status: 'cancelled' } : item))
        )
        continue
      }

      setQueue((prev) =>
        prev.map((item) => (item.id === currentItem.id ? { ...item, status: 'converting', progress: 0.1 } : item))
      )

      const itemStartTime = Date.now()

      const unsubProgress = converterClient.onProgress((id, prog) => {
        if (id.includes(currentItem.id) || id.startsWith('conv_')) {
          setQueue((prev) =>
            prev.map((item) => (item.id === currentItem.id ? { ...item, progress: prog } : item))
          )
        }
      })

      try {
        const bytesClone = currentItem.bytes.slice(0)
        const res = await converterClient.convert(currentItem.inputName, bytesClone, resources, options)
        const durationMs = Date.now() - itemStartTime

        if (res.success && res.output_bytes) {
          const isWarning = res.warnings.length > 0 || res.approximations.length > 0
          if (isWarning) warningCount++
          else successCount++

          setQueue((prev) =>
            prev.map((item) =>
              item.id === currentItem.id
                ? {
                    ...item,
                    status: isWarning ? 'warning' : 'success',
                    outputBytes: res.output_bytes,
                    vitalJson: res.vital_json,
                    name: res.name,
                    author: res.author,
                    category: res.category,
                    warnings: res.warnings,
                    approximations: res.approximations,
                    unsupported: res.unsupported,
                    errors: [],
                    durationMs,
                  }
                : item
            )
          )
        } else {
          failedCount++
          setQueue((prev) =>
            prev.map((item) =>
              item.id === currentItem.id
                ? {
                    ...item,
                    status: 'failed',
                    errors: res.errors.length > 0 ? res.errors : ['Unknown conversion error'],
                    durationMs,
                  }
                : item
            )
          )
        }
      } catch (err: any) {
        failedCount++
        const durationMs = Date.now() - itemStartTime
        setQueue((prev) =>
          prev.map((item) =>
            item.id === currentItem.id
              ? {
                  ...item,
                  status: 'failed',
                  errors: [err?.message || String(err)],
                  durationMs,
                }
              : item
          )
        )
      } finally {
        unsubProgress()
      }
    }

    const totalDurationMs = Date.now() - startTime
    setBatchSummary({
      total: currentQueue.length,
      success: successCount,
      warnings: warningCount,
      failed: failedCount,
      cancelled: cancelledCount,
      totalDurationMs,
    })

    setAppState('COMPLETE')
  }

  // Cancel batch
  const handleCancelBatch = () => {
    isCancelledRef.current = true
    converterClient.cancel()
  }

  // Remove single item
  const handleRemoveItem = (id: string) => {
    setQueue((prev) => prev.filter((i) => i.id !== id))
  }

  // Clear entire queue
  const handleClearQueue = () => {
    setQueue([])
    setBatchSummary(null)
    setAppState('READY')
  }

  // Download individual file
  const handleDownloadItem = (item: QueueItem) => {
    if (!item.outputBytes) return
    const name = item.outputName || item.inputName
    triggerFileDownload(item.outputBytes, name, 'application/json')
  }

  // Download all as ZIP (or single .vital if only 1 preset)
  const handleDownloadZip = async (organizeByCategory: boolean) => {
    const readyItems = queue.filter((i) => i.outputBytes && (i.status === 'success' || i.status === 'warning'))
    if (readyItems.length === 0) return

    // If only 1 preset, download directly as a .vital file (user gesture is immediate)
    if (readyItems.length === 1) {
      const item = readyItems[0]
      let name = item.outputName || `${item.inputName.replace(/\.[^/.]+$/, '')}.vital`
      if (!name.toLowerCase().endsWith('.vital')) {
        name += '.vital'
      }
      await triggerFileDownload(item.outputBytes!, name, 'application/octet-stream')
      return
    }

    // For batch ZIP: request Save File dialog IMMEDIATELY on click so user gesture never expires!
    const suggestedZipName = embedTimestampFilename('serum2vital_converted_presets.zip')
    let fileHandle: unknown = undefined

    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        fileHandle = await (window as unknown as {
          showSaveFilePicker: (options: {
            suggestedName: string
            types: Array<{
              description: string
              accept: Record<string, string[]>
            }>
          }) => Promise<unknown>
        }).showSaveFilePicker({
          suggestedName: suggestedZipName,
          types: [
            {
              description: 'ZIP Archive (*.zip)',
              accept: {
                'application/zip': ['.zip'],
              },
            },
          ],
        })
      } catch (err: unknown) {
        const error = err as { name?: string }
        // User clicked Cancel in the save dialog
        if (error.name === 'AbortError') return
        console.warn('Pre-emptive showSaveFilePicker failed:', err)
      }
    }

    setIsDownloadingZip(true)
    try {
      const zipBlob = await createPresetsZip(
        readyItems.map((item) => ({
          filename: item.outputName.endsWith('.vital') ? item.outputName : item.outputName + '.vital',
          bytes: item.outputBytes!,
          category: item.category,
        })),
        organizeByCategory
      )

      await triggerFileDownload(zipBlob, suggestedZipName, 'application/zip', fileHandle, true)
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string }
      if (error.name === 'AbortError') return
      alert('Failed to download ZIP: ' + (error.message || String(err)))
    } finally {
      setIsDownloadingZip(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex flex-col font-sans selection:bg-slate-200 selection:text-slate-900">
      {/* Header */}
      <Header
        onOpenAbout={() => setIsAboutOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Hidden input for "+ Add More" files */}
      <input
        ref={addFilesInputRef}
        type="file"
        multiple
        accept=".fxp,.SerumPreset"
        onChange={handleMultiFileInputChange}
        className="hidden"
      />

      {/* Floating Notifications Stack (Top-right below header, out-of-flow to prevent layout shifts) */}
      <aside
        aria-live="polite"
        aria-label="Notifications"
        className="fixed top-20 sm:top-24 right-4 sm:right-6 lg:right-8 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none"
      >
        {/* Runtime Status & Error Notification with Fade In & Fade Out */}
        {runtimeVisible && (appState === 'INITIALIZING' || appState === 'ERROR') && (
          <div className={`pointer-events-auto ${runtimeExiting ? 'toast-exit' : 'toast-enter'}`}>
            {appState === 'INITIALIZING' ? (
              <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-xl py-2.5 px-3.5 flex items-center gap-2.5 shadow-md text-xs text-slate-600">
                <svg className="animate-spin w-3.5 h-3.5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <div className="truncate">
                  <span className="text-slate-900 font-medium">Preparing runtime: </span>
                  <span className="text-slate-600">{engineMessage}</span>
                </div>
              </div>
            ) : (
              <div className="bg-rose-50/95 backdrop-blur-md border border-rose-200/90 rounded-xl py-2.5 px-3.5 flex items-start gap-2.5 shadow-md text-xs text-rose-900">
                <svg className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1 flex flex-col gap-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-rose-950">Runtime Error</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAppState('INITIALIZING')
                        setRuntimeVisible(true)
                        setRuntimeExiting(false)
                        setEngineMessage('Retrying runtime initialization...')
                        converterClient.init()
                      }}
                      className="text-[11px] font-medium text-rose-700 hover:text-rose-900 underline cursor-pointer"
                    >
                      Retry
                    </button>
                  </div>
                  <p className="text-rose-800 leading-relaxed text-[11px] break-words">
                    {engineMessage || 'Failed to initialize Python runtime environment.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stacked Drop Box Error & Notice Notifications (10s duration + dismiss button + Fade In & Fade Out) */}
        {notifications.map((item) => (
          <div
            key={item.id}
            className={`pointer-events-auto ${item.isExiting ? 'toast-exit' : 'toast-enter'}`}
          >
            <div
              className={`rounded-xl py-2.5 px-3.5 flex items-center justify-between gap-3 shadow-md text-xs backdrop-blur-md border transition-all ${
                item.type === 'warning'
                  ? 'bg-amber-50/95 border-amber-200 text-amber-900'
                  : item.type === 'error'
                  ? 'bg-rose-50/95 border-rose-200 text-rose-900'
                  : 'bg-white/95 border-slate-200/90 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    item.type === 'warning'
                      ? 'bg-amber-500'
                      : item.type === 'error'
                      ? 'bg-rose-500'
                      : 'bg-blue-500'
                  }`}
                />
                <span className="leading-snug">{item.text}</span>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveNotification(item.id)}
                className="text-slate-400 hover:text-slate-700 font-semibold text-base cursor-pointer px-1 py-0.5 shrink-0 transition-colors"
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </aside>

      {/* Main Container */}
      <main className="flex-1 max-w-[870px] w-full mx-auto px-4 py-8 sm:py-12 flex flex-col gap-6">
        {/* Converter Hero Section */}
        <div className="text-center flex flex-col items-center gap-2 pb-1 my-[50px]">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
            Serum to Vital Converter
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md leading-relaxed">
            Convert Xfer Serum preset (.fxp, .SerumPreset) format to Vital preset (.vital) format
          </p>
        </div>

        {/* Two Symmetrical Side-by-Side Drop Boxes (Stationary & Non-shifting) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full items-stretch">
          <DropZone
            onFilesSelect={addFilesToQueue}
            disabled={appState === 'PROCESSING'}
            onNotice={handleAddNotification}
          />
          <ResourceDropZone
            resources={resources}
            onResourcesChange={setResources}
            disabled={appState === 'PROCESSING'}
            onNotice={handleAddNotification}
          />
        </div>

        {/* File Queue List (Always visible to maintain rock-solid layout) */}
        <FileQueue
          queue={queue}
          resources={resources}
          onResourcesChange={setResources}
          onDownloadItem={handleDownloadItem}
          onRemoveItem={handleRemoveItem}
          onClearQueue={handleClearQueue}
          onAddMoreFiles={() => addFilesInputRef.current?.click()}
          onConvertAll={handleConvertAll}
          onCancel={handleCancelBatch}
          isProcessing={appState === 'PROCESSING'}
          canConvert={appState !== 'INITIALIZING' && appState !== 'PROCESSING'}
        />

        {/* Batch Conversion Summary */}
        {batchSummary && (
          <BatchSummaryCard
            summary={batchSummary}
            onDownloadZip={handleDownloadZip}
            onClear={handleClearQueue}
            isDownloadingZip={isDownloadingZip}
          />
        )}
      </main>

      {/* Settings Modal */}
      <ConversionSettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        options={options}
        onOptionsChange={setOptions}
      />

      {/* About Modal */}
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />
    </div>
  )
}
