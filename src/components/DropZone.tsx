import { useState, useRef } from 'react'

interface DropZoneProps {
  onFilesSelect: (files: { name: string; bytes: ArrayBuffer }[]) => void
  disabled?: boolean
  onNotice?: (notice: { type: 'info' | 'warning'; text: string } | null) => void
}

export function DropZone({ onFilesSelect, disabled, onNotice }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isReading, setIsReading] = useState(false)
  const [internalNotice, setInternalNotice] = useState<{ type: 'info' | 'warning'; text: string } | null>(null)
  const setNotice = (n: { type: 'info' | 'warning'; text: string } | null) => {
    setInternalNotice(n)
    onNotice?.(n)
  }

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const processFiles = async (files: File[]) => {
    setIsReading(true)
    setNotice(null)

    const readResults: { name: string; bytes: ArrayBuffer }[] = []
    let skippedCount = 0
    let wavNotice = false

    for (const file of files) {
      const ext = file.name.toLowerCase()
      if (ext.endsWith('.wav')) {
        wavNotice = true
        continue
      }
      if (
        !ext.endsWith('.fxp') &&
        !ext.endsWith('.serumpreset') &&
        !ext.endsWith('.serum_preset')
      ) {
        skippedCount++
        continue
      }

      try {
        const bytes = await file.arrayBuffer()
        readResults.push({ name: file.name, bytes })
      } catch (err) {
        console.warn('Failed to read preset:', file.name, err)
      }
    }

    setIsReading(false)

    if (readResults.length === 0) {
      if (wavNotice) {
        setNotice({
          type: 'warning',
          text: '.wav audio files should be added to the Drop wavetables & noises box on the right.',
        })
      } else {
        setNotice({
          type: 'warning',
          text: 'No valid Serum presets (.fxp or .SerumPreset) found.',
        })
      }
      return
    }

    if (wavNotice) {
      setNotice({
        type: 'info',
        text: `Loaded ${readResults.length} preset(s). Notice: .wav files should be dropped into the right box.`,
      })
    } else if (skippedCount > 0) {
      setNotice({
        type: 'info',
        text: `Loaded ${readResults.length} preset(s) (ignored ${skippedCount} non-preset file${skippedCount > 1 ? 's' : ''}).`,
      })
    } else {
      setNotice(null)
    }

    onFilesSelect(readResults)
  }

  const extractFilesFromDataTransfer = async (dt: DataTransfer): Promise<File[]> => {
    const result: File[] = []
    if (dt.items && dt.items.length > 0 && typeof dt.items[0].webkitGetAsEntry === 'function') {
      const queue: any[] = []
      for (let i = 0; i < dt.items.length; i++) {
        const entry = dt.items[i].webkitGetAsEntry()
        if (entry) queue.push(entry)
      }

      async function traverse(entry: any): Promise<void> {
        if (!entry) return
        if (entry.isFile) {
          await new Promise<void>((resolve) => {
            entry.file(
              (file: File) => {
                result.push(file)
                resolve()
              },
              () => resolve()
            )
          })
        } else if (entry.isDirectory) {
          const reader = entry.createReader()
          await new Promise<void>((resolve) => {
            const readEntriesBatch = () => {
              reader.readEntries(
                async (entries: any[]) => {
                  if (!entries || entries.length === 0) {
                    resolve()
                  } else {
                    for (const sub of entries) {
                      await traverse(sub)
                    }
                    readEntriesBatch()
                  }
                },
                () => resolve()
              )
            }
            readEntriesBatch()
          })
        }
      }

      for (const entry of queue) {
        await traverse(entry)
      }
      return result
    }
    return Array.from(dt.files || [])
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (disabled || isReading) return
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (disabled || isReading) return

    const files = await extractFilesFromDataTransfer(e.dataTransfer)
    await processFiles(files)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) processFiles(files)
    e.target.value = ''
  }

  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) processFiles(files)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".fxp,.SerumPreset,.serum_preset"
        onChange={handleFileInputChange}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
        multiple
        onChange={handleFolderInputChange}
        className="hidden"
      />

      {/* Main Converter Card */}
      <div
        role="region"
        aria-label="Drop preset files or folder here"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl px-6 py-[19px] sm:px-7 sm:py-[23px] flex flex-col items-center justify-center gap-3.5 transition-all duration-150 outline-none h-full min-h-[270px] ${
          isDragOver
            ? 'border-blue-500 bg-blue-50/60 shadow-sm'
            : 'border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50/70 shadow-xs'
        }`}
      >
        {/* Soft Blue Icon Badge */}
        <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-blue-50 border border-blue-100 text-blue-600 transition-transform pointer-events-none">
          {isReading ? (
            <svg className="animate-spin w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          )}
        </div>

        <div className="text-center flex flex-col gap-1 pointer-events-none">
          <div className="font-semibold text-slate-900 text-[20px] tracking-tight">
            {isReading ? 'Reading presets...' : 'Drop presets or folder'}
          </div>
          <div className="flex items-center justify-center gap-1.5 text-xs pt-0.5">
            <span className="text-slate-800 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
              .fxp
            </span>
            <span className="text-slate-800 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
              .SerumPreset
            </span>
          </div>
        </div>

        {/* Clean Balanced Buttons Row */}
        <div className="flex items-center gap-2 pt-0.5">
          <button
            type="button"
            disabled={disabled || isReading}
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-lg text-xs sm:text-sm font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-slate-400 shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Choose Files</span>
          </button>

          <button
            type="button"
            disabled={disabled || isReading}
            onClick={() => folderInputRef.current?.click()}
            className="px-4 py-2 rounded-lg text-xs sm:text-sm font-medium bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-300 hover:border-slate-400 shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span>Choose Folder</span>
          </button>
        </div>
      </div>

            {/* In-card fallback only if onNotice is not provided */}
      {!onNotice && internalNotice && (
        <div
          className={`text-xs py-2 px-3 rounded-xl flex items-center justify-between gap-2 border ${
            internalNotice.type === 'warning'
              ? 'text-amber-800 bg-amber-50 border-amber-200'
              : 'text-slate-700 bg-slate-100 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
            <span>{internalNotice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-slate-400 hover:text-slate-700 text-xs cursor-pointer px-1"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
