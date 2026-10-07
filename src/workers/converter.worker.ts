
function pruneSerum2State(val: unknown): unknown {
  if (val === null || val === undefined) return val
  if (typeof val === 'bigint') return Number(val)
  if (typeof val === 'number' || typeof val === 'boolean' || typeof val === 'string') return val

  if (ArrayBuffer.isView(val)) {
    if ((val as Uint8Array).length > 256) return []
    return Array.from(val as unknown as number[])
  }

  if (val instanceof Map) {
    const obj: Record<string, unknown> = {}
    for (const [k, v] of val.entries()) {
      const keyStr = String(k)
      if (keyStr === 'embedded_audio' || keyStr === 'audioData') continue
      obj[keyStr] = pruneSerum2State(v)
    }
    return obj
  }

  if (Array.isArray(val)) {
    if (val.length > 256 && typeof val[0] === 'number') {
      return []
    }
    return val.map(pruneSerum2State)
  }

  if (typeof val === 'object') {
    const obj: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(val)) {
      if (k === 'embedded_audio' || k === 'audioData') continue
      obj[k] = pruneSerum2State(v)
    }
    return obj
  }

  return val
}

import * as fzstd from 'fzstd'
import * as cbor from 'cbor-x'
import { PYTHON_BUNDLE } from '../pyodide/pythonBundle'
import type {
  ConversionOptions,
  ConversionResultPayload,
  ResourceMap,
  WorkerRequest,
  WorkerResponse,
  WorkerState,
} from '../converter/messages'

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.mjs'

let pyodideInstance: any = null

interface QueuedItem {
  id: string
  filename: string
  bytes: ArrayBuffer
  resources?: ResourceMap
  options?: ConversionOptions
}

const queue: QueuedItem[] = []
let isProcessing = false
const cancelledIds = new Set<string>()
let cancelAllRequested = false

function setState(newState: WorkerState, message?: string) {
  self.postMessage({
    type: 'STATUS',
    state: newState,
    message,
  } as WorkerResponse)
}

async function initPyodide(): Promise<any> {
  if (pyodideInstance) return pyodideInstance

  setState('LOADING', 'Downloading Pyodide WebAssembly runtime…')

  try {
    const { loadPyodide } = await import(/* @vite-ignore */ PYODIDE_CDN)

    setState('LOADING', 'Initializing virtual Python environment…')

    const pyodide = await loadPyodide({
      stdout: (text: string) => console.log('[Pyodide stdout]', text),
      stderr: (text: string) => console.error('[Pyodide stderr]', text),
    })

    setState('LOADING', 'Mounting serum2vital engine modules…')

    const packageDir = '/home/pyodide/serum2vital'
    pyodide.FS.mkdirTree(packageDir)

    for (const [filename, source] of Object.entries(PYTHON_BUNDLE)) {
      pyodide.FS.writeFile(`${packageDir}/${filename}`, source)
    }

    await pyodide.runPythonAsync(`
import sys, gc
if '/home/pyodide' not in sys.path:
    sys.path.insert(0, '/home/pyodide')

from serum2vital import web_adapter
print('serum2vital engine ready')
`)

    pyodideInstance = pyodide
    setState('READY', 'Engine initialized and ready')
    self.postMessage({ type: 'READY', message: 'Engine ready' } as WorkerResponse)
    return pyodide
  } catch (err: any) {
    const msg = err?.message || String(err)
    setState('ERROR', `Initialization error: ${msg}`)
    self.postMessage({ type: 'ERROR', message: msg } as WorkerResponse)
    throw err
  }
}

async function processQueue() {
  if (isProcessing) return
  isProcessing = true

  while (queue.length > 0) {
    const item = queue.shift()!

    if (cancelAllRequested || cancelledIds.has(item.id)) {
      cancelledIds.delete(item.id)
      self.postMessage({ type: 'CANCELLED', id: item.id } as WorkerResponse)
      continue
    }

    setState('CONVERTING', `Converting ${item.filename}…`)

    self.postMessage({
      type: 'PROGRESS',
      id: item.id,
      progress: 0.1,
      message: `Reading ${item.filename}…`,
    } as WorkerResponse)

    try {
      const pyodide = await initPyodide()

      self.postMessage({
        type: 'PROGRESS',
        id: item.id,
        progress: 0.35,
        message: 'Parsing binary preset & wavetables…',
      } as WorkerResponse)

      const uint8 = new Uint8Array(item.bytes)
      const optionsObj: Record<string, any> = { ...(item.options || {}) }

      // Serum 2 pre-decompression in JS (fzstd + cbor-x)
      const fnLower = item.filename.toLowerCase()
      const isSerum2 =
        fnLower.endsWith('.serumpreset') ||
        fnLower.endsWith('.serum_preset') ||
        (uint8.length >= 9 && String.fromCharCode(...uint8.subarray(0, 8)) === 'XferJson')

      if (isSerum2) {
        try {
          const view = new DataView(uint8.buffer, uint8.byteOffset, uint8.byteLength)
          const jsonLen = Number(view.getBigUint64(9, true))
          const headerEnd = 9 + 8
          const metaStr = new TextDecoder().decode(uint8.subarray(headerEnd, headerEnd + jsonLen))
          const meta = JSON.parse(metaStr)
          const cursor = headerEnd + jsonLen
          const zstdPayload = uint8.subarray(cursor + 8)
          const decompressed = fzstd.decompress(zstdPayload)
          const state = cbor.decode(decompressed)

          optionsObj.serum2_meta = meta
          optionsObj.serum2_state = pruneSerum2State(state)
        } catch (s2Err: any) {
          console.warn('[Worker] Pre-decoding Serum 2 container in JS failed:', s2Err)
          throw new Error(`Failed to decode Serum 2 container: ${s2Err?.message || String(s2Err)}`)
        }
      }

      pyodide.globals.set('input_bytes_js', uint8)
      pyodide.globals.set('filename_js', item.filename)
      pyodide.globals.set(
        'resources_json_js',
        item.resources ? JSON.stringify(item.resources) : ''
      )
      pyodide.globals.set('options_json_js', JSON.stringify(optionsObj))

      self.postMessage({
        type: 'PROGRESS',
        id: item.id,
        progress: 0.65,
        message: 'Translating parameters and curves…',
      } as WorkerResponse)

      const rawJson = await pyodide.runPythonAsync(`
from serum2vital import web_adapter
import gc

bytes_data = bytes(input_bytes_js.to_py())
fn = str(filename_js)
res_json = str(resources_json_js) if resources_json_js else None
opt_json = str(options_json_js) if options_json_js else None

res_str = web_adapter.convert_file_json(bytes_data, fn, resources_json=res_json, options_json=opt_json)

del bytes_data, fn, res_json, opt_json
gc.collect()

res_str
`)

      self.postMessage({
        type: 'PROGRESS',
        id: item.id,
        progress: 0.9,
        message: 'Finalizing Vital preset document…',
      } as WorkerResponse)

      const parsed = JSON.parse(rawJson)

      let outputBuffer: ArrayBuffer | null = null
      if (parsed.output_base64) {
        const binStr = atob(parsed.output_base64)
        const u8 = new Uint8Array(binStr.length)
        for (let i = 0; i < binStr.length; i++) {
          u8[i] = binStr.charCodeAt(i)
        }
        outputBuffer = u8.buffer
        delete parsed.output_base64
      }

      const payload: ConversionResultPayload = {
        success: Boolean(parsed.success),
        id: item.id,
        filename: item.filename,
        output_filename: parsed.output_filename || `${item.filename.replace(/\.[^/.]+$/, '')}.vital`,
        output_bytes: outputBuffer,
        vital_json: parsed.vital_json || null,
        name: parsed.name || '',
        author: parsed.author || '',
        category: parsed.category || [],
        warnings: parsed.warnings || [],
        approximations: parsed.approximations || [],
        unsupported: parsed.unsupported || [],
        errors: parsed.errors || [],
      }

      self.postMessage({
        type: 'PROGRESS',
        id: item.id,
        progress: 1.0,
        message: 'Conversion complete',
      } as WorkerResponse)

      const ctx = self as unknown as { postMessage: (msg: any, transfer?: Transferable[]) => void }
      if (payload.output_bytes) {
        ctx.postMessage({ type: 'RESULT', payload } as WorkerResponse, [payload.output_bytes])
      } else {
        ctx.postMessage({ type: 'RESULT', payload } as WorkerResponse)
      }
    } catch (err: any) {
      const msg = err?.message || String(err)
      self.postMessage({
        type: 'RESULT',
        payload: {
          success: false,
          id: item.id,
          filename: item.filename,
          output_filename: '',
          output_bytes: null,
          vital_json: null,
          name: '',
          author: '',
          category: [],
          warnings: [],
          approximations: [],
          unsupported: [],
          errors: [msg],
        },
      } as WorkerResponse)
    }
  }

  isProcessing = false
  cancelAllRequested = false
  setState('READY', 'Ready for conversions')
}

self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const data = event.data
  if (!data) return

  if (data.type === 'INIT') {
    try {
      await initPyodide()
    } catch {
      // Error is surfaced via state
    }
    return
  }

  if (data.type === 'CANCEL') {
    if (data.id) {
      cancelledIds.add(data.id)
    } else {
      cancelAllRequested = true
      for (const item of queue) {
        cancelledIds.add(item.id)
      }
      queue.length = 0
    }
    return
  }

  if (data.type === 'RESET') {
    queue.length = 0
    cancelledIds.clear()
    cancelAllRequested = false
    setState('READY', 'Queue reset')
    return
  }

  if (data.type === 'CONVERT') {
    queue.push({
      id: data.id,
      filename: data.filename,
      bytes: data.bytes,
      resources: data.resources,
      options: data.options,
    })

    processQueue()
  }
})