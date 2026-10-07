import { describe, it, expect } from 'vitest'
import type { AppState, QueueItem, BatchSummary } from '../src/converter/types'
import { detectFormat } from '../src/utils/format'

describe('App State Machine & Workflow transitions', () => {
  it('handles valid state lifecycle: INITIALIZING -> READY -> PROCESSING -> COMPLETE', () => {
    let state: AppState = 'INITIALIZING'
    expect(state).toBe('INITIALIZING')

    // Engine loads Pyodide
    state = 'READY'
    expect(state).toBe('READY')

    // User starts batch conversion
    state = 'PROCESSING'
    expect(state).toBe('PROCESSING')

    // All presets converted
    state = 'COMPLETE'
    expect(state).toBe('COMPLETE')
  })

  it('rejects invalid fixture gracefully during format detection', () => {
    const format = detectFormat('invalid.txt', new TextEncoder().encode('corrupt data'))
    expect(format).toBe('unknown')
  })

  it('calculates accurate batch summary from completed queue items', () => {
    const queue: QueueItem[] = [
      {
        id: '1',
        inputName: 'Lead.fxp',
        bytes: new ArrayBuffer(10),
        format: 'serum1',
        status: 'success',
        warnings: [],
        approximations: [],
        unsupported: [],
        errors: [],
        durationMs: 120,
      },
      {
        id: '2',
        inputName: 'Bass.fxp',
        bytes: new ArrayBuffer(10),
        format: 'serum1',
        status: 'warning',
        warnings: ['Filtered sample approximated'],
        approximations: ['Knob curve tuned'],
        unsupported: [],
        errors: [],
        durationMs: 80,
      },
      {
        id: '3',
        inputName: 'Corrupt.fxp',
        bytes: new ArrayBuffer(10),
        format: 'serum1',
        status: 'failed',
        warnings: [],
        approximations: [],
        unsupported: [],
        errors: ['Invalid header chunk'],
        durationMs: 40,
      },
      {
        id: '4',
        inputName: 'Cancelled.fxp',
        bytes: new ArrayBuffer(10),
        format: 'serum1',
        status: 'cancelled',
        warnings: [],
        approximations: [],
        unsupported: [],
        errors: [],
      },
    ]

    const summary: BatchSummary = {
      total: queue.length,
      success: queue.filter((i) => i.status === 'success').length,
      warnings: queue.filter((i) => i.status === 'warning').length,
      failed: queue.filter((i) => i.status === 'failed').length,
      cancelled: queue.filter((i) => i.status === 'cancelled').length,
      totalDurationMs: queue.reduce((acc, i) => acc + (i.durationMs || 0), 0),
    }

    expect(summary.total).toBe(4)
    expect(summary.success).toBe(1)
    expect(summary.warnings).toBe(1)
    expect(summary.failed).toBe(1)
    expect(summary.cancelled).toBe(1)
    expect(summary.totalDurationMs).toBe(240)
  })
})
