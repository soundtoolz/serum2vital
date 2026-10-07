import * as fzstd from 'fzstd'
import * as cbor from 'cbor-x'

const BUILTIN_SHAPES = new Set([
  '',
  'sine',
  'sin',
  'triangle',
  'tri',
  'saw',
  'sawtooth',
  'square',
  'pulse',
  'pulse25',
  'basic shapes',
  'default shapes',
  'analog_saw',
  'analog_square',
])

function isBuiltin(ref: string): boolean {
  if (!ref) return true
  const clean = ref.replace(/\\/g, '/').split('/').pop()?.toLowerCase() || ''
  const stem = clean.replace(/\.wav$/i, '').trim()
  return BUILTIN_SHAPES.has(stem)
}

async function decompressZlib(compressed: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate')
  const writer = ds.writable.getWriter()
  writer.write(compressed as any)
  writer.close()
  const reader = ds.readable.getReader()
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}

export interface PresetDependencies {
  wavetables: string[]
  samples: string[]
}

export interface DependencyCheckResult {
  hasRequirements: boolean
  isReady: boolean
  missing: Array<{ type: 'wavetable' | 'sample'; name: string }>
  satisfied: string[]
}

export async function inspectPresetDependencies(
  bytes: ArrayBuffer,
  filename: string
): Promise<PresetDependencies> {
  const wavetables: string[] = []
  const samples: string[] = []
  const u8 = new Uint8Array(bytes)

  try {
    const isS1 =
      (u8.length >= 20 &&
        u8[0] === 67 &&
        u8[1] === 99 &&
        u8[2] === 110 &&
        u8[3] === 75) ||
      filename.toLowerCase().endsWith('.fxp')

    if (isS1) {
      if (u8.length > 60) {
        const compressed = u8.subarray(60)
        const decompressed = await decompressZlib(compressed)
        if (decompressed.length >= 0x4208) {
          const dec = new TextDecoder('latin1')
          const oscA = dec.decode(decompressed.subarray(0x3c08, 0x3e08)).split('\0')[0].trim()
          const oscB = dec.decode(decompressed.subarray(0x3e08, 0x4008)).split('\0')[0].trim()
          const noise = dec.decode(decompressed.subarray(0x4008, 0x4208)).split('\0')[0].trim()

          if (oscA && !isBuiltin(oscA)) wavetables.push(oscA)
          if (oscB && !isBuiltin(oscB)) wavetables.push(oscB)
          if (noise) samples.push(noise)
        }
      }
      return { wavetables, samples }
    }

    // Serum 2 check ('XferJson\0')
    const isS2 =
      (u8.length >= 9 &&
        u8[0] === 88 &&
        u8[1] === 102 &&
        u8[2] === 101 &&
        u8[3] === 114) ||
      filename.toLowerCase().endsWith('.serumpreset')

    if (isS2 && u8.length > 25) {
      const dv = new DataView(bytes)
      const metaLen = Number(dv.getBigUint64(9, true))
      const metaEnd = 17 + metaLen
      const compressed = u8.subarray(metaEnd + 8)
      const decompressed = fzstd.decompress(compressed)
      const state = cbor.decode(decompressed) as Record<string, any>

      if (state && typeof state === 'object') {
        for (let i = 0; i < 4; i++) {
          const osc = state['Oscillator' + i]
          const wt = osc?.['WTOsc' + i]
          if (wt?.relativePathToWT && typeof wt.relativePathToWT === 'string') {
            if (!isBuiltin(wt.relativePathToWT)) {
              wavetables.push(wt.relativePathToWT)
            }
          }
        }
        const noise = state.Oscillator3?.NoiseOsc3?.relativePathToNoiseSample
        if (noise && typeof noise === 'string') {
          samples.push(noise)
        }
      }
    }
  } catch (err) {
    console.warn('Dependency inspection notice for', filename, err)
  }

  return { wavetables, samples }
}

export function checkDependencyStatus(
  deps: PresetDependencies,
  resources: Record<string, string>
): DependencyCheckResult {
  const resourceKeys = Object.keys(resources).map((k) => k.toLowerCase())
  const resourceStems = resourceKeys.map((k) =>
    k.replace(/\.wav$/i, '').replace(/\\/g, '/').split('/').pop() || ''
  )

  const isMatched = (ref: string): boolean => {
    const clean = ref.toLowerCase().replace(/\\/g, '/')
    const base = clean.split('/').pop() || ''
    const stem = base.replace(/\.wav$/i, '')

    return (
      resourceKeys.includes(clean) ||
      resourceKeys.includes(base) ||
      resourceStems.includes(stem)
    )
  }

  const missing: Array<{ type: 'wavetable' | 'sample'; name: string }> = []
  const satisfied: string[] = []

  for (const wt of deps.wavetables) {
    const cleanName = wt.replace(/\\/g, '/').split('/').pop() || wt
    if (isMatched(wt)) {
      satisfied.push(cleanName)
    } else {
      missing.push({ type: 'wavetable', name: cleanName })
    }
  }

  for (const s of deps.samples) {
    const cleanName = s.replace(/\\/g, '/').split('/').pop() || s
    if (isMatched(s)) {
      satisfied.push(cleanName)
    } else {
      missing.push({ type: 'sample', name: cleanName })
    }
  }

  const hasRequirements = deps.wavetables.length > 0 || deps.samples.length > 0
  const isReady = !hasRequirements || missing.length === 0

  return {
    hasRequirements,
    isReady,
    missing,
    satisfied,
  }
}
