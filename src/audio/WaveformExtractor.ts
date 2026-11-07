import type { WaveformData } from '../types/dj'

/**
 * Extracts high-density 3-band frequency peaks (Low, Mid, High) and overall peak envelopes
 * directly from AudioBuffer channel data using fast digital IIR filtering.
 * Provides ~100-120 data points per second for razor-sharp 60 FPS waveform scrolling.
 */
export async function extractWaveformData(
  audioBuffer: AudioBuffer,
  pointsPerSec = 100
): Promise<WaveformData> {
  const sampleRate = audioBuffer.sampleRate
  const totalSamples = audioBuffer.length
  const duration = audioBuffer.duration

  const targetPoints = Math.max(1000, Math.floor(duration * pointsPerSec))
  const rawData = audioBuffer.getChannelData(0)

  const peaks = new Float32Array(targetPoints)
  const lowPeaks = new Float32Array(targetPoints)
  const midPeaks = new Float32Array(targetPoints)
  const highPeaks = new Float32Array(targetPoints)

  // Digital single-pole IIR filter coefficients:
  // Lowpass filter cutoff ~250 Hz (Kicks & Bass)
  const lowCutoff = 250
  const alphaLow = (2 * Math.PI * lowCutoff) / sampleRate

  // Highpass filter cutoff ~3500 Hz (Hi-hats & Cymbals)
  const highCutoff = 3500
  const alphaHigh = (2 * Math.PI * highCutoff) / sampleRate

  const step = Math.floor(totalSamples / targetPoints)

  // Track filter states across the audio stream
  let lowState = 0
  let highState = 0

  for (let i = 0; i < targetPoints; i++) {
    const start = i * step
    const end = Math.min(totalSamples, start + step)

    let maxRaw = 0
    let maxLow = 0
    let maxMid = 0
    let maxHigh = 0

    // Step by 2 or 4 samples for speed while maintaining high peak accuracy
    for (let j = start; j < end; j += 2) {
      const sample = rawData[j]
      const absSample = Math.abs(sample)

      // Lowpass single-pole filter
      lowState += alphaLow * (sample - lowState)
      const lowVal = Math.abs(lowState)

      // High-frequency component: highState tracks low-mid, high is difference
      highState += alphaHigh * (sample - highState)
      const highVal = Math.abs(sample - highState)

      // Mid component: remainder between low and high
      const midVal = Math.max(0, absSample - lowVal * 0.7 - highVal * 0.7)

      if (absSample > maxRaw) maxRaw = absSample
      if (lowVal > maxLow) maxLow = lowVal
      if (midVal > maxMid) maxMid = midVal
      if (highVal > maxHigh) maxHigh = highVal
    }

    // Normalized peak envelopes with contrast enhancements
    peaks[i] = Math.min(1.0, maxRaw)
    lowPeaks[i] = Math.min(1.0, maxLow * 2.2) // punchy bass
    midPeaks[i] = Math.min(1.0, maxMid * 1.8) // vocal presence
    highPeaks[i] = Math.min(1.0, maxHigh * 2.5) // crisp hats
  }

  return {
    peaks,
    lowPeaks,
    midPeaks,
    highPeaks,
    length: targetPoints,
  }
}
