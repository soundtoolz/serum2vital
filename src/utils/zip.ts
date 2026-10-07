import JSZip from 'jszip'

export interface ZipPresetItem {
  filename: string
  bytes: ArrayBuffer
  category?: string[]
}

export async function createPresetsZip(
  items: ZipPresetItem[],
  organizeByCategory: boolean = false
): Promise<Blob> {
  const zip = new JSZip()
  const folder = zip.folder('serum2vital_presets') || zip

  for (const item of items) {
    let relativePath = item.filename
    if (organizeByCategory && item.category && item.category.length > 0) {
      const instrument = item.category[0] || 'SYNTH'
      relativePath = `${instrument}/${item.filename}`
    }
    folder.file(relativePath, item.bytes)
  }

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}