import type {
  ConversionOptions,
  ConversionResultPayload,
  ResourceMap,
  WorkerRequest,
  WorkerResponse,
  WorkerState,
} from '../converter/messages'

export type StatusListener = (state: WorkerState, message: string) => void
export type ProgressListener = (id: string, progress: number, message: string) => void

class ConverterClient {
  private worker: Worker | null = null
  private state: WorkerState = 'UNINITIALIZED'
  private statusMessage: string = 'Engine not initialized'
  private statusListeners: Set<StatusListener> = new Set()
  private progressListeners: Set<ProgressListener> = new Set()
  private pendingRequests: Map<
    string,
    {
      resolve: (res: ConversionResultPayload) => void
      reject: (err: any) => void
    }
  > = new Map()

  constructor() {
    this.initWorker()
  }

  private initWorker() {
    if (this.worker) return

    this.worker = new Worker(
      new URL('../workers/converter.worker.ts', import.meta.url),
      { type: 'module' }
    )

    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const data = event.data
      if (!data) return

      switch (data.type) {
        case 'STATUS': {
          this.state = data.state
          this.statusMessage = data.message || ''
          this.notifyStatus()
          break
        }
        case 'READY': {
          this.state = 'READY'
          this.statusMessage = data.message || 'Ready'
          this.notifyStatus()
          break
        }
        case 'PROGRESS': {
          for (const listener of this.progressListeners) {
            listener(data.id, data.progress, data.message)
          }
          break
        }
        case 'RESULT': {
          const handler = this.pendingRequests.get(data.payload.id)
          if (handler) {
            this.pendingRequests.delete(data.payload.id)
            handler.resolve(data.payload)
          }
          break
        }
        case 'CANCELLED': {
          const handler = this.pendingRequests.get(data.id)
          if (handler) {
            this.pendingRequests.delete(data.id)
            handler.resolve({
              success: false,
              id: data.id,
              filename: '',
              output_filename: '',
              output_bytes: null,
              vital_json: null,
              name: '',
              author: '',
              category: [],
              warnings: [],
              approximations: [],
              unsupported: [],
              errors: ['Conversion cancelled by user'],
            })
          }
          break
        }
        case 'ERROR': {
          this.state = 'ERROR'
          this.statusMessage = data.message
          this.notifyStatus()
          if (data.id) {
            const handler = this.pendingRequests.get(data.id)
            if (handler) {
              this.pendingRequests.delete(data.id)
              handler.reject(new Error(data.message))
            }
          }
          break
        }
      }
    }

    this.worker.onerror = (err) => {
      console.error('[ConverterClient Worker Error]', err)
      this.state = 'ERROR'
      this.statusMessage = err.message || 'Worker runtime error'
      this.notifyStatus()
    }
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener)
    listener(this.state, this.statusMessage)
    return () => this.statusListeners.delete(listener)
  }

  public onProgress(listener: ProgressListener): () => void {
    this.progressListeners.add(listener)
    return () => this.progressListeners.delete(listener)
  }

  private notifyStatus() {
    for (const listener of this.statusListeners) {
      listener(this.state, this.statusMessage)
    }
  }

  public init(): void {
    if (!this.worker) this.initWorker()
    this.worker?.postMessage({ type: 'INIT' } as WorkerRequest)
  }

  public async convert(
    filename: string,
    bytes: ArrayBuffer,
    resources?: ResourceMap,
    options?: ConversionOptions
  ): Promise<ConversionResultPayload> {
    if (!this.worker) this.initWorker()

    const id = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

    return new Promise<ConversionResultPayload>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject })

      // Transferable ArrayBuffer zero-copy
      this.worker?.postMessage(
        {
          type: 'CONVERT',
          id,
          filename,
          bytes,
          resources,
          options,
        } as WorkerRequest,
        [bytes]
      )
    })
  }

  public cancel(id?: string): void {
    this.worker?.postMessage({ type: 'CANCEL', id } as WorkerRequest)
  }

  public reset(): void {
    this.worker?.postMessage({ type: 'RESET' } as WorkerRequest)
  }

  public getState(): WorkerState {
    return this.state
  }
}

export const converterClient = new ConverterClient()