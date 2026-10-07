// Strip characters not allowed in file systems
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARACTERS = /[<>:"/\\|?*\x00-\x1f]+/g

export function getCleanBaseName(filename: string): string {
  // Strip .fxp, .SerumPreset, etc.
  const withoutExt = filename.replace(/\.(fxp|serumpreset|serum_preset)$/i, '')
  const safe = withoutExt.replace(UNSAFE_CHARACTERS, '_').trim()
  return safe || 'Preset'
}

export function deduplicateOutputNames(
  items: { id: string; name: string }[]
): Map<string, string> {
  const result = new Map<string, string>()
  const claimedNames = new Set<string>()

  for (const item of items) {
    const base = getCleanBaseName(item.name)
    let candidate = `${base}.vital`
    let counter = 2

    while (claimedNames.has(candidate.toLowerCase())) {
      candidate = `${base} (${counter}).vital`
      counter++
    }

    claimedNames.add(candidate.toLowerCase())
    result.set(item.id, candidate)
  }

  return result
}