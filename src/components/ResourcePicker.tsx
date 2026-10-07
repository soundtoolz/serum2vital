import { useState, useRef } from 'react'

interface ResourcePickerProps {
  resources: Record<string, string>
  onResourcesChange: (resources: Record<string, string>) => void
  disabled?: boolean
}

export function ResourcePicker({
  resources,
  onResourcesChange,
  disabled,
}: ResourcePickerProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const audioInputRef = useRef<HTMLInputElement>(null)

  const addFilesToResources = async (files: File[]) => {
    setIsLoading(true)
    const newResources = { ...resources }

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.wav')) continue
      try {
        const buf = await file.arrayBuffer()
        const bytes = new Uint8Array(buf)
        let binary = ''
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i])
        }
        const b64 = btoa(binary)
        newResources[file.name] = b64
        newResources[file.name.replace(/\.wav$/i, '')] = b64
      } catch (err) {
        console.warn('Failed to read resource file:', file.name, err)
      }
    }

    onResourcesChange(newResources)
    setIsLoading(false)
  }

  const handleRemoveResource = (name: string) => {
    const updated = { ...resources }
    delete updated[name]
    delete updated[`${name}.wav`]
    delete updated[name.replace(/\.wav$/i, '')]
    onResourcesChange(updated)
  }

  const handleClearResources = () => {
    onResourcesChange({})
  }

  const displayNames = Object.keys(resources).filter((k) => k.toLowerCase().endsWith('.wav'))

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col gap-3.5 shadow-xs">
      <input
        ref={audioInputRef}
        type="file"
        multiple
        accept=".wav"
        onChange={(e) => {
          if (e.target.files) {
            addFilesToResources(Array.from(e.target.files))
          }
          e.target.value = ''
        }}
        className="hidden"
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900 text-sm">Wavetables & Samples</h3>
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
              Optional
            </span>
            {displayNames.length > 0 && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                {displayNames.length} .wav loaded
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Provide custom Serum .wav files to embed them into converted Vital presets.
          </p>
        </div>

        {displayNames.length > 0 && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer border border-slate-200"
            >
              {isExpanded ? 'Hide' : `View (${displayNames.length})`}
            </button>
            <button
              type="button"
              onClick={handleClearResources}
              className="text-xs text-slate-500 hover:text-rose-600 px-2 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Button Row */}
      <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
        <button
          type="button"
          disabled={disabled || isLoading}
          onClick={() => audioInputRef.current?.click()}
          className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-slate-400 shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <svg className="w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 10v4" />
            <path d="M6 7v10" />
            <path d="M10 4v16" />
            <path d="M14 8v8" />
            <path d="M18 6v12" />
            <path d="M22 10v4" />
          </svg>
          <span>Add .wav Files</span>
        </button>

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono pl-1">
            <svg className="animate-spin w-3.5 h-3.5 text-slate-700" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Loading...</span>
          </div>
        )}
      </div>

      {/* Expanded File List */}
      {isExpanded && displayNames.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-col gap-1 max-h-36 overflow-y-auto">
          {displayNames.map((name) => (
            <div key={name} className="flex items-center justify-between text-xs text-slate-700 font-mono py-1 px-2 rounded hover:bg-white border border-transparent hover:border-slate-200">
              <span className="truncate max-w-[85%]">{name}</span>
              <button
                type="button"
                onClick={() => handleRemoveResource(name)}
                className="text-slate-400 hover:text-rose-600 text-xs cursor-pointer px-1"
                aria-label={`Remove ${name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
