import type { ConversionOptions } from '../converter/messages'

interface ConversionSettingsProps {
  isOpen: boolean
  onClose: () => void
  options: ConversionOptions
  onOptionsChange: (newOptions: ConversionOptions) => void
}

export function ConversionSettings({
  isOpen,
  onClose,
  options,
  onOptionsChange,
}: ConversionSettingsProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 flex flex-col gap-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">Conversion Settings</h3>
              <p className="text-xs text-slate-500">Configure audio synthesis conversion parameters</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Setting Items */}
        <div className="flex flex-col gap-3.5 text-xs">
          {/* Wavetables toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <div className="font-medium text-slate-900">Embed Wavetables</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Convert and embed custom Serum oscillator wavetables</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={options.include_wavetables ?? true}
              onClick={() =>
                onOptionsChange({
                  ...options,
                  include_wavetables: !(options.include_wavetables ?? true),
                })
              }
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                (options.include_wavetables ?? true) ? 'bg-slate-900' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  (options.include_wavetables ?? true) ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Noise Samples toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <div className="font-medium text-slate-900">Embed Noise Samples</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Convert and embed noise oscillator PCM samples</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={options.include_samples ?? true}
              onClick={() =>
                onOptionsChange({
                  ...options,
                  include_samples: !(options.include_samples ?? true),
                })
              }
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                (options.include_samples ?? true) ? 'bg-slate-900' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  (options.include_samples ?? true) ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Max Keyframes Selector */}
          <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex justify-between items-center">
              <span className="font-medium text-slate-900">Max Wavetable Keyframes</span>
              <span className="font-mono text-slate-900 text-xs font-semibold">{options.max_frames ?? 64} frames</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Controls Vital wavetable keyframe density. Higher values preserve detailed morphing; lower values keep preset size compact.
            </div>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {[16, 32, 64, 128].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => onOptionsChange({ ...options, max_frames: val })}
                  className={`py-1.5 rounded-lg font-mono text-xs border transition-colors cursor-pointer ${
                    (options.max_frames ?? 64) === val
                      ? 'bg-slate-900 text-white border-slate-900 font-semibold shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

          {/* Max Sample Length Slider */}
          <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex justify-between items-center">
              <span className="font-medium text-slate-900">Max Sample Duration</span>
              <span className="font-mono text-slate-900 text-xs font-semibold">{options.max_sample_seconds ?? 4.0}s</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Maximum seconds to embed for noise sample loops.
            </div>
            <input
              type="range"
              min="1"
              max="8"
              step="0.5"
              value={options.max_sample_seconds ?? 4.0}
              onChange={(e) =>
                onOptionsChange({
                  ...options,
                  max_sample_seconds: parseFloat(e.target.value),
                })
              }
              className="accent-slate-900 mt-2 cursor-pointer"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-5 rounded-lg font-medium bg-slate-900 hover:bg-slate-800 text-white text-xs transition-colors cursor-pointer shadow-xs"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  )
}
