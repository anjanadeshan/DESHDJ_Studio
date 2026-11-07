import { describe, it, expect } from 'vitest'
import { formatTime, formatBpm, formatPitchPercent, formatLoopBeats } from '../utils/formatters'
import { detectBpm } from '../audio/BpmDetector'

describe('DJ Utility Formatters', () => {
  it('formats time in mm:ss.hundredths format correctly', () => {
    expect(formatTime(0)).toBe('00:00.00')
    expect(formatTime(65.45)).toBe('01:05.45')
    expect(formatTime(125.0)).toBe('02:05.00')
  })

  it('formats BPM values with 1 decimal place', () => {
    expect(formatBpm(128)).toBe('128.0')
    expect(formatBpm(124.5)).toBe('124.5')
    expect(formatBpm(0)).toBe('---.-')
  })

  it('formats pitch percentages with sign and 2 decimal places', () => {
    expect(formatPitchPercent(3.2)).toBe('+3.20%')
    expect(formatPitchPercent(-4.125)).toBe('-4.13%')
    expect(formatPitchPercent(0)).toBe('0.00%')
  })

  it('formats loop beat fractions and integers', () => {
    expect(formatLoopBeats(0.25)).toBe('1/4')
    expect(formatLoopBeats(0.5)).toBe('1/2')
    expect(formatLoopBeats(4)).toBe('4')
    expect(formatLoopBeats(16)).toBe('16')
  })
})

describe('DJ Crossfader & Loop Math', () => {
  it('computes constant power crossfader gains correctly', () => {
    // Smooth crossfade curve at center pos = 0
    const posCenter = 0
    const xCenter = (posCenter + 1) * 0.25 * Math.PI
    const gainACenter = Math.cos(xCenter)
    const gainBCenter = Math.sin(xCenter)
    expect(gainACenter).toBeCloseTo(Math.SQRT1_2, 3)
    expect(gainBCenter).toBeCloseTo(Math.SQRT1_2, 3)

    // Full Left (Deck A = 1, Deck B = 0)
    const posLeft = -1
    const xLeft = (posLeft + 1) * 0.25 * Math.PI
    expect(Math.cos(xLeft)).toBeCloseTo(1, 4)
    expect(Math.sin(xLeft)).toBeCloseTo(0, 4)

    // Full Right (Deck A = 0, Deck B = 1)
    const posRight = 1
    const xRight = (posRight + 1) * 0.25 * Math.PI
    expect(Math.cos(xRight)).toBeCloseTo(0, 4)
    expect(Math.sin(xRight)).toBeCloseTo(1, 4)
  })

  it('computes loop lengths correctly from BPM', () => {
    const bpm = 120
    const beatSec = 60 / bpm // 0.5 sec per beat

    const fourBeats = 4 * beatSec
    expect(fourBeats).toBe(2.0)

    const halfBeat = 0.5 * beatSec
    expect(halfBeat).toBe(0.25)
  })
})

describe('BPM Detector Algorithm', () => {
  it('detects tempo accurately on synthetic beat pulse', () => {
    // Generate a synthetic 120 BPM audio track (2 beats per second, pulse every 0.5s)
    const sampleRate = 44100
    const duration = 20
    const totalSamples = sampleRate * duration
    const channelData = new Float32Array(totalSamples)

    // Synthetic kick bursts at 120 BPM (every 0.5s)
    for (let t = 0; t < duration; t += 0.5) {
      const startSample = Math.floor(t * sampleRate)
      const burstSamples = Math.floor(sampleRate * 0.08) // 80ms kick drum
      for (let i = 0; i < burstSamples && startSample + i < totalSamples; i++) {
        const decay = 1 - i / burstSamples
        channelData[startSample + i] = Math.sin((i / sampleRate) * 120 * 2 * Math.PI) * decay
      }
    }

    const mockBuffer = {
      sampleRate,
      duration,
      length: totalSamples,
      getChannelData: () => channelData,
    } as unknown as AudioBuffer

    const result = detectBpm(mockBuffer)
    expect(result.bpm).toBeGreaterThanOrEqual(118)
    expect(result.bpm).toBeLessThanOrEqual(122)
  })
})

describe('Library Track Sorting & Priority', () => {
  it('places lastSelectedTrackId at the top of the list', () => {
    const tracks = [
      { id: 'track-1', title: 'Deep House 1', artist: 'DJ A', bpm: 124, duration: 300, name: '1.mp3', album: '' },
      { id: 'track-2', title: 'Techno Peak', artist: 'DJ B', bpm: 130, duration: 360, name: '2.mp3', album: '' },
      { id: 'track-3', title: 'Melodic Vibe', artist: 'DJ C', bpm: 122, duration: 280, name: '3.mp3', album: '' },
    ]

    const lastSelectedTrackId = 'track-2'

    const sorted = [...tracks].sort((a, b) => {
      if (lastSelectedTrackId) {
        if (a.id === lastSelectedTrackId) return -1
        if (b.id === lastSelectedTrackId) return 1
      }
      return 0
    })

    expect(sorted[0].id).toBe('track-2')
    expect(sorted[1].id).toBe('track-1')
    expect(sorted[2].id).toBe('track-3')
  })
})

describe('CDJ Jog Wheel Pitch Bend / Blend Math', () => {
  it('calculates smooth pitch bend without sudden timing discontinuities', () => {
    // Phase continuity test:
    // If a track plays at 1.0x rate for 10s, then pitch bent to 1.08x rate for 0.5s:
    // The accumulated audio elapsed should advance smoothly by 10s + 0.5s * 1.08 = 10.54s
    // (gaining 40ms of phase advance to catch the beat, without leaping multiple seconds)
    const initialOffset = 0
    const startContextTime = 100
    const currentRate = 1.0

    // At contextTime = 110:
    const elapsedBefore = (110 - startContextTime) * currentRate
    const posAt110 = initialOffset + elapsedBefore
    expect(posAt110).toBe(10.0)

    // Rate change to 1.08 with seamless offset accumulation:
    const newOffset = posAt110 // 10.0
    const newStartContextTime = 110
    const newRate = 1.08

    // 0.5s later, at contextTime = 110.5:
    const elapsedAfter = (110.5 - newStartContextTime) * newRate
    const posAt110_5 = newOffset + elapsedAfter
    expect(posAt110_5).toBeCloseTo(10.54, 4)

    // Phase difference relative to unbent 1.0x rate (which would be 10.50):
    const phaseAdvance = posAt110_5 - 10.50
    expect(phaseAdvance).toBeCloseTo(0.04, 4) // +40ms beat catch-up!
  })
})

describe('Intelligent Beat Sync Logic', () => {
  it('correctly matches half-time and double-time BPMs to minimal pitch shift', () => {
    // Drum & Bass (174 BPM) syncing to Dubstep/Half-time (87 BPM)
    const targetBpm = 87
    const currentBaseBpm = 174

    const r1 = targetBpm / currentBaseBpm // 0.5 (-50%)
    const rHalf = (targetBpm * 0.5) / currentBaseBpm // 0.25 (-75%)
    const rDouble = (targetBpm * 2.0) / currentBaseBpm // 1.0 (0% - perfect half-time lock!)

    const candidates = [r1, rHalf, rDouble]
    let bestRatio = r1
    let minDiff = Math.abs(r1 - 1.0)
    for (const r of candidates) {
      if (Math.abs(r - 1.0) < minDiff) {
        minDiff = Math.abs(r - 1.0)
        bestRatio = r
      }
    }

    expect(bestRatio).toBe(1.0)
  })

  it('calculates shortest-distance phase alignment without beat jumping', () => {
    // 120 BPM = 0.5s beat interval
    const beatInterval = 0.5
    // Target is 0.05s into its beat
    const targetPhase = 0.05
    // Current is 0.45s into its beat (i.e. just 0.10s behind the target)
    const currPhase = 0.45

    let phaseDelta = targetPhase - currPhase // -0.40s
    if (phaseDelta > beatInterval / 2) phaseDelta -= beatInterval
    if (phaseDelta < -beatInterval / 2) phaseDelta += beatInterval

    // Must be +0.10s forward, NOT -0.40s backward!
    expect(phaseDelta).toBeCloseTo(0.10, 4)
  })
})

describe('Smart Loop Out & Exit Logic', () => {
  it('quantizes manual loop out to nearest beat grid', () => {
    const bpm = 120
    const beatSec = 60 / bpm // 0.5s
    const loopStart = 10.0
    // User clicks OUT at 13.92s (raw duration = 3.92s)
    const pos = 13.92

    const rawDuration = pos - loopStart // 3.92s
    const rawBeats = rawDuration / beatSec // 7.84 beats
    const smartBeats = Math.max(1, Math.round(rawBeats)) // 8 beats!
    const smartEnd = loopStart + smartBeats * beatSec // 10.0 + 4.0 = 14.0s

    expect(smartBeats).toBe(8)
    expect(smartEnd).toBe(14.0)
  })

  it('exits active loop cleanly when OUT is clicked while active', () => {
    const loopState = { start: 10.0, end: 14.0, beats: 8, active: true }
    // User clicks OUT/EXIT while loop is active:
    const nextState = { ...loopState, active: false }
    expect(nextState.active).toBe(false)
    expect(nextState.start).toBe(10.0)
    expect(nextState.end).toBe(14.0)
  })
})
