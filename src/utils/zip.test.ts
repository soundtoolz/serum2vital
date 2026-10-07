import { describe, it, expect } from 'vitest'
import { createPresetsZip, type ZipPresetItem } from './zip'
import JSZip from 'jszip'

describe('createPresetsZip', () => {
  it('creates a zip containing all presets in serum2vital_presets directory', async () => {
    const textEncoder = new TextEncoder()
    const items: ZipPresetItem[] = [
      {
        filename: 'Bass 01.vital',
        bytes: textEncoder.encode('mock vital data 1').buffer,
      },
      {
        filename: 'Lead 02.vital',
        bytes: textEncoder.encode('mock vital data 2').buffer,
      },
    ]

    const blob = await createPresetsZip(items, false)
    expect(blob.size).toBeGreaterThan(0)

    const arrayBuffer = await blob.arrayBuffer()
    const unzipped = await JSZip.loadAsync(arrayBuffer)

    expect(unzipped.file('serum2vital_presets/Bass 01.vital')).not.toBeNull()
    expect(unzipped.file('serum2vital_presets/Lead 02.vital')).not.toBeNull()

    const content1 = await unzipped.file('serum2vital_presets/Bass 01.vital')?.async('string')
    expect(content1).toBe('mock vital data 1')
  })

  it('organizes presets into category subfolders when requested', async () => {
    const textEncoder = new TextEncoder()
    const items: ZipPresetItem[] = [
      {
        filename: 'Heavy Bass.vital',
        bytes: textEncoder.encode('bass data').buffer,
        category: ['BASS', 'SUB'],
      },
      {
        filename: 'Trance Lead.vital',
        bytes: textEncoder.encode('lead data').buffer,
        category: ['LEAD'],
      },
    ]

    const blob = await createPresetsZip(items, true)
    const arrayBuffer = await blob.arrayBuffer()
    const unzipped = await JSZip.loadAsync(arrayBuffer)

    expect(unzipped.file('serum2vital_presets/BASS/Heavy Bass.vital')).not.toBeNull()
    expect(unzipped.file('serum2vital_presets/LEAD/Trance Lead.vital')).not.toBeNull()
  })
})
