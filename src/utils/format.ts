/**
 * Utility for detecting Serum preset format from filename and binary signature.
 */
export type PresetFormat = 'serum1' | 'serum2' | 'unknown'

export function detectFormat(filename: string, data?: Uint8Array): PresetFormat {
  const lower = filename.toLowerCase()

  // First check binary magic bytes if available
  if (data && data.length >= 8) {
    // Serum 2: starts with ASCII 'XferJson\\0'
    const isXferJson =
      data[0] === 0x58 && // 'X'
      data[1] === 0x66 && // 'f'
      data[2] === 0x65 && // 'e'
      data[3] === 0x72 && // 'r'
      data[4] === 0x4a && // 'J'
      data[5] === 0x73 && // 's'
      data[6] === 0x6f && // 'o'
      data[7] === 0x6e    // 'n'
    if (isXferJson) return 'serum2'

    // Serum 1 FXP chunk magic 'CcnK'
    const isCcnK =
      data[0] === 0x43 && // 'C'
      data[1] === 0x63 && // 'c'
      data[2] === 0x6e && // 'n'
      data[3] === 0x4b    // 'K'
    if (isCcnK) return 'serum1'
  }

  // Fallback to extension check
  if (lower.endsWith('.serumpreset') || lower.endsWith('.serum_preset')) {
    return 'serum2'
  }
  if (lower.endsWith('.fxp')) {
    return 'serum1'
  }

  return 'unknown'
}
