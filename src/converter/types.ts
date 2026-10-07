export type AppState = 'INITIALIZING' | 'READY' | 'PROCESSING' | 'COMPLETE' | 'ERROR'

export type ItemStatus =
  | 'waiting'
  | 'converting'
  | 'success'
  | 'warning'
  | 'failed'
  | 'cancelled'

export interface QueueItem {
  id: string
  inputName: string
  outputName: string
  bytes: ArrayBuffer
  format: 'serum1' | 'serum2'
  status: ItemStatus
  progress?: number
  outputBytes?: ArrayBuffer | null
  vitalJson?: string | null
  name?: string
  author?: string
  category?: string[]
  warnings: string[]
  approximations: string[]
  unsupported: string[]
  errors: string[]
  durationMs?: number
  dependencies?: {
    wavetables: string[]
    samples: string[]
  }
}

export interface BatchSummary {
  total: number
  success: number
  warnings: number
  failed: number
  cancelled: number
  totalDurationMs: number
}