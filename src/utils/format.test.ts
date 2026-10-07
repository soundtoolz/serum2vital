import { describe, it, expect } from 'vitest'
import { detectFormat } from './format'

describe('detectFormat', () => {
  it('detects serum1 from .fxp extension', () => {
    expect(detectFormat('Lead.fxp')).toBe('serum1')
    expect(detectFormat('BASS.FXP')).toBe('serum1')
    expect(detectFormat('my.sound.patch.fxp')).toBe('serum1')
  })

  it('detects serum2 from .SerumPreset and .serum_preset extension', () => {
    expect(detectFormat('Lead.SerumPreset')).toBe('serum2')
    expect(detectFormat('pad.serumpreset')).toBe('serum2')
    expect(detectFormat('sub.serum_preset')).toBe('serum2')
  })

  it('detects format from binary magic bytes', () => {
    // Serum 2: XferJson\0
    const s2Bytes = new Uint8Array([0x58, 0x66, 0x65, 0x72, 0x4a, 0x73, 0x6f, 0x6e, 0x00, 0x00])
    expect(detectFormat('unknown_name.dat', s2Bytes)).toBe('serum2')

    // Serum 1: CcnK
    const s1Bytes = new Uint8Array([0x43, 0x63, 0x6e, 0x4b, 0x00, 0x00, 0x00, 0x00])
    expect(detectFormat('generic.bin', s1Bytes)).toBe('serum1')
  })

  it('returns unknown for unsupported extensions without magic bytes', () => {
    expect(detectFormat('song.wav')).toBe('unknown')
    expect(detectFormat('preset.vital')).toBe('unknown')
    expect(detectFormat('notes.txt')).toBe('unknown')
  })
})
