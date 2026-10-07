interface AboutModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 flex flex-col gap-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-100">
              S2V
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">About Serum2Vital Web</h3>
              <p className="text-xs text-slate-500">Client-side synthesizer preset converter</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-4 text-xs text-slate-600 leading-relaxed">
          <p>
            <strong className="text-slate-900">Serum2Vital Web</strong> translates Xfer Serum 1 (<code className="bg-slate-100 text-slate-800 font-mono px-1 py-0.5 rounded border border-slate-200">.fxp</code>) and Serum 2 (<code className="bg-slate-100 text-slate-800 font-mono px-1 py-0.5 rounded border border-slate-200">.SerumPreset</code>) synthesizer presets into Vital (<code className="bg-slate-100 text-slate-800 font-mono px-1 py-0.5 rounded border border-slate-200">.vital</code>) format entirely in your browser using Pyodide WebAssembly.
          </p>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col gap-1.5">
            <div className="font-semibold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span> How It Works
            </div>
            <p className="text-slate-600">
              The conversion algorithm parses Serum's binary modulation matrix, knob curves, envelopes, filters, and effect rack parameters, translating them mathematically to Vital 1.5.5 equivalents. Everything runs inside a background Web Worker — your files never leave your computer.
            </p>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col gap-1.5">
            <div className="font-semibold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Attribution & Upstream Engine
            </div>
            <p className="text-slate-600">
              The core parameter translation engine is based on the open-source project <a href="https://github.com/btesser/serum2vital" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline underline-offset-2 hover:text-blue-800">btesser/serum2vital</a>.
            </p>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col gap-1.5">
            <div className="font-semibold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-500"></span> License
            </div>
            <p className="text-slate-600">
              This project is licensed under the <strong className="text-slate-800">GNU General Public License v3.0 or later (GPL-3.0-or-later)</strong>.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-5 rounded-lg font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition-colors cursor-pointer border border-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
