interface ProgressBarProps {
  progress: number // 0 to 1
  message: string
}

export function ProgressBar({ progress, message }: ProgressBarProps) {
  const percentage = Math.round(Math.min(100, Math.max(0, progress * 100)))

  return (
    <div
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Preset conversion progress"
      className="flex flex-col gap-2 bg-[#141721] p-4 rounded-xl border border-[#2a2f45] shadow-inner"
    >
      <div className="flex justify-between items-center text-xs">
        <span className="text-[#a78bfa] font-medium truncate max-w-[80%]">{message || 'Processing in Worker…'}</span>
        <span className="text-[#94a3b8] font-mono font-semibold">{percentage}%</span>
      </div>
      <div className="w-full h-2 rounded-full bg-[#22263a] overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#7c5df9] to-[#a78bfa] transition-all duration-150 rounded-full"
          style={{ width: `${Math.max(4, percentage)}%` }}
        />
      </div>
    </div>
  )
}