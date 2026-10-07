import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import * as fzstd from 'fzstd'
import * as cbor from 'cbor-x'

describe('Serum 2 decompression & CBOR unpacking', () => {
  it('parses tests/fixtures/minimal.SerumPreset container structure', () => {
    const filePath = path.resolve('tests/fixtures/minimal.SerumPreset')
    const fileBuf = fs.readFileSync(filePath)
    const u8 = new Uint8Array(fileBuf)

    // Check magic signature 'XferJson\0'
    const magic = new TextDecoder().decode(u8.slice(0, 9))
    expect(magic).toBe('XferJson\0')

    // Read JSON length (little-endian 64-bit int at offset 9)
    const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength)
    const jsonLen = Number(view.getBigUint64(9, true))
    expect(jsonLen).toBeGreaterThan(0)

    // Extract JSON metadata
    const headerEnd = 9 + 8
    const jsonBytes = u8.slice(headerEnd, headerEnd + jsonLen)
    const meta = JSON.parse(new TextDecoder().decode(jsonBytes))
    expect(meta).toHaveProperty('version')
    expect(meta).toHaveProperty('presetName')
    expect(meta).toHaveProperty('product', 'Serum2')

    // Skip uncompressed size (uint32) + encoding (uint32) -> 8 bytes
    const cursor = headerEnd + jsonLen
    const zstdPayload = u8.slice(cursor + 8)

    // Decompress with fzstd
    const decompressed = fzstd.decompress(zstdPayload)
    expect(decompressed.length).toBeGreaterThan(0)

    // Decode CBOR state
    const state = cbor.decode(decompressed)
    expect(state).toBeDefined()
    expect(typeof state).toBe('object')
  })
})
