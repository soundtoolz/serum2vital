import { describe, it, expect } from 'vitest'
import { getCleanBaseName, deduplicateOutputNames } from './naming'

describe('naming utils', () => {
  describe('getCleanBaseName', () => {
    it('strips .fxp extension cleanly', () => {
      expect(getCleanBaseName('SuperSaw.fxp')).toBe('SuperSaw')
      expect(getCleanBaseName('bass_01.FXP')).toBe('bass_01')
    })

    it('strips .SerumPreset and .serum_preset cleanly', () => {
      expect(getCleanBaseName('ModernLead.SerumPreset')).toBe('ModernLead')
      expect(getCleanBaseName('SubPluck.serum_preset')).toBe('SubPluck')
    })

    it('handles files with multiple dots', () => {
      expect(getCleanBaseName('patch.v1.0.final.fxp')).toBe('patch.v1.0.final')
    })

    it('sanitizes illegal filesystem characters', () => {
      expect(getCleanBaseName('Lead: 100% <Fire>?.fxp')).toBe('Lead_ 100% _Fire_')
    })

    it('defaults to Preset if stripped name is empty', () => {
      expect(getCleanBaseName('.fxp')).toBe('Preset')
    })
  })

  describe('deduplicateOutputNames', () => {
    it('generates standard .vital names when no duplicates exist', () => {
      const items = [
        { id: '1', name: 'Bass.fxp' },
        { id: '2', name: 'Lead.fxp' },
      ]
      const map = deduplicateOutputNames(items)
      expect(map.get('1')).toBe('Bass.vital')
      expect(map.get('2')).toBe('Lead.vital')
    })

    it('appends incrementing suffixes for duplicate names', () => {
      const items = [
        { id: '1', name: 'Pluck.fxp' },
        { id: '2', name: 'Pluck.SerumPreset' },
        { id: '3', name: 'Pluck.FXP' },
      ]
      const map = deduplicateOutputNames(items)
      expect(map.get('1')).toBe('Pluck.vital')
      expect(map.get('2')).toBe('Pluck (2).vital')
      expect(map.get('3')).toBe('Pluck (3).vital')
    })
  })
})
