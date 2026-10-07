export type WorkerState = 'UNINITIALIZED' | 'LOADING' | 'READY' | 'CONVERTING' | 'ERROR'

export interface ConversionOptions {
  max_frames?: number
  max_sample_seconds?: number
  include_wavetables?: boolean
  include_samples?: boolean
}

export type ResourceMap = Record<string, string> // filename -> base64

export type WorkerRequest =
  | { type: 'INIT' }
  | {
      type: 'CONVERT'
      id: string
      filename: string
      bytes: ArrayBuffer
      resources?: ResourceMap
      options?: ConversionOptions
    }
  | { type: 'CANCEL'; id?: string }
  | { type: 'RESET' }

export interface ConversionResultPayload {
  success: boolean
  id: string
  filename: string
  output_filename: string
  output_bytes?: ArrayBuffer | null
  vital_json?: string | null
  name: string
  author: string
  category: string[]
  warnings: string[]
  approximations: string[]
  unsupported: string[]
  errors: string[]
}

export type WorkerResponse =
  | { type: 'READY'; message?: string }
  | { type: 'STATUS'; state: WorkerState; message?: string }
  | { type: 'PROGRESS'; id: string; progress: number; message: string }
  | { type: 'RESULT'; payload: ConversionResultPayload }
  | { type: 'CANCELLED'; id: string }
  | { type: 'ERROR'; id?: string; message: string }