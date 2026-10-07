import { describe, it, expect } from 'vitest'
import { checkDependencyStatus } from './dependencies'

describe('checkDependencyStatus', () => {
  it('returns isReady: true and hasRequirements: false when no wavetables or samples required', () => {
    const res = checkDependencyStatus({ wavetables: [], samples: [] }, {})
    expect(res.hasRequirements).toBe(false)
    expect(res.isReady).toBe(true)
    expect(res.missing).toHaveLength(0)
    expect(res.satisfied).toHaveLength(0)
  })

  it('marks missing when wavetable is required but not loaded in resources', () => {
    const res = checkDependencyStatus(
      { wavetables: ['Custom_Growl.wav'], samples: [] },
      {}
    )
    expect(res.hasRequirements).toBe(true)
    expect(res.isReady).toBe(false)
    expect(res.missing).toHaveLength(1)
    expect(res.missing[0]).toEqual({
      type: 'wavetable',
      name: 'Custom_Growl.wav',
    })
  })

  it('marks ready when required wavetable is found in resources (case-insensitive & extension-tolerant)', () => {
    const res = checkDependencyStatus(
      { wavetables: ['S2 Tables/Cyber_Growl.wav'], samples: [] },
      { 'cyber_growl.wav': 'mock-base64' }
    )
    expect(res.hasRequirements).toBe(true)
    expect(res.isReady).toBe(true)
    expect(res.missing).toHaveLength(0)
    expect(res.satisfied).toContain('Cyber_Growl.wav')
  })

  it('correctly reports missing noise samples with their exact names', () => {
    const res = checkDependencyStatus(
      { wavetables: [], samples: ['Noises/Vinyl_Crackle.wav'] },
      {}
    )
    expect(res.hasRequirements).toBe(true)
    expect(res.isReady).toBe(false)
    expect(res.missing).toHaveLength(1)
    expect(res.missing[0]).toEqual({
      type: 'sample',
      name: 'Vinyl_Crackle.wav',
    })
  })

  it('marks ready when sample is provided in resources', () => {
    const res = checkDependencyStatus(
      { wavetables: [], samples: ['Vinyl_Crackle.wav'] },
      { 'vinyl_crackle.wav': 'mock-base64' }
    )
    expect(res.isReady).toBe(true)
    expect(res.missing).toHaveLength(0)
  })
})
