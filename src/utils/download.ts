/**
 * Embeds the exact time in milliseconds at the end of the filename (e.g. name_1728306000123.zip).
 * This guarantees a 100% unique filename every time the download button is clicked,
 * completely preventing Windows "File already exists. Do you want to replace it?" prompts.
 */
export function embedTimestampFilename(filename: string): string {
  const now = Date.now()
  const dotIndex = filename.lastIndexOf('.')
  const base = dotIndex !== -1 ? filename.slice(0, dotIndex) : filename
  const ext = dotIndex !== -1 ? filename.slice(dotIndex) : ''

  // If filename already ends with an exact millisecond timestamp (13+ digits), replace it with fresh click time
  const cleanBase = base.replace(/_\d{13,}$/, '')
  return `${cleanBase}_${now}${ext}`
}

/**
 * Guaranteed file download helper for presets and ZIP archives.
 * Uses the native File System Access API (showSaveFilePicker) on Chromium/Windows
 * with exact millisecond timestamping so that:
 * 1. Chrome never substitutes a random UUID for the filename.
 * 2. Windows never asks "file already exists, do you want to replace it?".
 */
export async function triggerFileDownload(
  data: ArrayBuffer | Uint8Array | Blob,
  filename: string,
  mimeType = 'application/octet-stream',
  existingHandle?: unknown,
  skipTimestamp = false
): Promise<void> {
  let finalName = filename.trim()
  const isZip = finalName.toLowerCase().endsWith('.zip') || mimeType === 'application/zip'

  if (!finalName.toLowerCase().endsWith('.vital') && !finalName.toLowerCase().endsWith('.zip')) {
    finalName += isZip ? '.zip' : '.vital'
  }
  // Sanitize illegal filesystem chars
  finalName = finalName.replace(/[/\\?%*:|"<>]/g, '_')

  // Embed exact time in milliseconds at the end of the filename
  if (!skipTimestamp) {
    finalName = embedTimestampFilename(finalName)
  }

  // Convert input to Uint8Array and Blob
  let bytes: Uint8Array
  let blob: Blob

  if (data instanceof Blob) {
    blob = data
    const buffer = await data.arrayBuffer()
    bytes = new Uint8Array(buffer)
  } else if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data)
    blob = new Blob([bytes as unknown as BlobPart], { type: isZip ? 'application/zip' : mimeType })
  } else {
    bytes = data
    blob = new Blob([bytes as unknown as BlobPart], { type: isZip ? 'application/zip' : mimeType })
  }

  // If a file handle was already acquired with active user gesture
  if (existingHandle) {
    try {
      const handle = existingHandle as {
        createWritable: () => Promise<{
          write: (data: Uint8Array) => Promise<void>
          close: () => Promise<void>
        }>
      }
      const writable = await handle.createWritable()
      await writable.write(bytes)
      await writable.close()
      return
    } catch (err: unknown) {
      console.warn('Writing to existingHandle failed:', err)
    }
  }

  // 1. Primary method: Native File System Access API (Chrome/Edge on Windows)
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const isZipFile = finalName.toLowerCase().endsWith('.zip')
      const handle = await (window as unknown as {
        showSaveFilePicker: (options: {
          suggestedName: string
          types: Array<{
            description: string
            accept: Record<string, string[]>
          }>
        }) => Promise<{
          createWritable: () => Promise<{
            write: (data: Uint8Array) => Promise<void>
            close: () => Promise<void>
          }>
        }>
      }).showSaveFilePicker({
        suggestedName: finalName,
        types: [
          isZipFile
            ? {
                description: 'ZIP Archive (*.zip)',
                accept: {
                  'application/zip': ['.zip'],
                },
              }
            : {
                description: 'Vital Synthesizer Preset (*.vital)',
                accept: {
                  'application/vital': ['.vital'],
                  'application/octet-stream': ['.vital'],
                },
              },
        ],
      })

      const writable = await handle.createWritable()
      await writable.write(bytes)
      await writable.close()
      return
    } catch (err: unknown) {
      const error = err as { name?: string }
      // User clicked "Cancel" in the file picker dialog
      if (error.name === 'AbortError') {
        return
      }
      console.warn('showSaveFilePicker failed, attempting Blob fallback:', err)
    }
  }

  // 2. Fallback for non-supporting browsers
  const downloadBlob = blob.type
    ? blob
    : new Blob([bytes as unknown as BlobPart], {
        type: isZip ? 'application/zip' : mimeType,
      })

  const blobUrl = URL.createObjectURL(downloadBlob)
  const a = document.createElement('a')
  a.style.display = 'none'
  a.href = blobUrl
  a.download = finalName
  a.setAttribute('download', finalName)

  document.body.appendChild(a)
  a.click()

  setTimeout(() => {
    if (a.parentNode) {
      document.body.removeChild(a)
    }
    URL.revokeObjectURL(blobUrl)
  }, 2000)
}
