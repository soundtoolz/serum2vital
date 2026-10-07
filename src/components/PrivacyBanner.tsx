export function PrivacyBanner() {
  return (
    <div className="border border-slate-200 rounded-xl p-3.5 bg-white flex items-center gap-3 text-xs text-slate-600 shadow-xs">
      <div className="w-5 h-5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center flex-shrink-0">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <span className="font-medium text-slate-900">100% Client-Side Processing. </span>
        <span>All conversions run locally in your browser via WebAssembly. No audio, presets, or user data are ever uploaded.</span>
      </div>
    </div>
  )
}
