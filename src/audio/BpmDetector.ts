/**
 * High-Precision BPM & Beatgrid Transient Detector
 * Uses low-pass kick isolation (<180Hz), a 300Hz onset energy envelope,
 * and high-resolution autocorrelation with parabolic peak refinement.
 */

export interface BpmAnalysisResult {
  bpm: number
  firstBeatTime: number
  confidence: number
}

export function detectBpm(audioBuffer: AudioBuffer): BpmAnalysisResult {
  const sampleRate = audioBuffer.sampleRate
  const rawData = audioBuffer.getChannelData(0)
  const totalSamples = audioBuffer.length

  // Analyze a representative 60-second window starting at ~15s (after intro fade-ins)
  const startSec = Math.min(15, audioBuffer.duration * 0.1)
  const durationSec = Math.min(60, Math.max(10, audioBuffer.duration - startSec))

  const startSample = Math.floor(startSec * sampleRate)
  const countSamples = Math.floor(durationSec * sampleRate)
  const endSample = Math.min(totalSamples, startSample + countSamples)

  // 1. Low-pass filter at 180Hz to isolate kick drum rhythm
  const cutoffHz = 180
  const alpha = (2 * Math.PI * cutoffHz) / sampleRate
  let filteredPrev = 0

  // 2. Compute 300Hz onset energy envelope (3.33ms resolution for high tempo precision)
  const envSampleRate = 300
  const samplesPerEnvStep = Math.max(1, Math.floor(sampleRate / envSampleRate))
  const envLength = Math.floor((endSample - startSample) / samplesPerEnvStep)
  const energyEnvelope = new Float32Array(envLength)

  let envIdx = 0
  let stepSum = 0
  let stepCount = 0

  for (let i = startSample; i < endSample; i++) {
    const raw = rawData[i]
    filteredPrev += alpha * (raw - filteredPrev)
    stepSum += filteredPrev * filteredPrev
    stepCount++

    if (stepCount >= samplesPerEnvStep) {
      if (envIdx < envLength) {
        energyEnvelope[envIdx] = Math.sqrt(stepSum / stepCount)
        envIdx++
      }
      stepSum = 0
      stepCount = 0
    }
  }

  // 3. Compute Half-Wave Rectified Spectral Flux / Onset curve
  const onsets = new Float32Array(envLength)
  for (let i = 1; i < envLength; i++) {
    const diff = energyEnvelope[i] - energyEnvelope[i - 1]
    onsets[i] = diff > 0 ? diff : 0
  }

  // 4. Autocorrelation across tempo range: 75 BPM to 180 BPM
  const minBpm = 75
  const maxBpm = 180
  const minLag = Math.floor((60 / maxBpm) * envSampleRate) // ~100 samples
  const maxLag = Math.ceil((60 / minBpm) * envSampleRate)  // ~240 samples

  const autocorr = new Float32Array(maxLag + 1)
  let maxCorr = 0
  let bestLag = Math.floor((60 / 124) * envSampleRate)

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0
    let count = 0
    for (let i = 0; i < envLength - lag; i++) {
      sum += onsets[i] * onsets[i + lag]
      count++
    }
    const val = count > 0 ? sum / count : 0
    autocorr[lag] = val

    if (val > maxCorr) {
      maxCorr = val
      bestLag = lag
    }
  }

  // 5. Parabolic peak interpolation around bestLag for sub-sample accuracy
  let refinedLag = bestLag
  if (bestLag > minLag && bestLag < maxLag) {
    const y0 = autocorr[bestLag - 1]
    const y1 = autocorr[bestLag]
    const y2 = autocorr[bestLag + 1]
    const denom = 2 * (2 * y1 - y0 - y2)
    if (Math.abs(denom) > 1e-6) {
      const delta = (y0 - y2) / denom
      refinedLag = bestLag + Math.max(-0.5, Math.min(0.5, delta))
    }
  }

  // Convert refined lag back to BPM
  let detectedBpm = (60 * envSampleRate) / refinedLag

  // Handle double/half tempo octave errors:
  if (detectedBpm < 75 && detectedBpm * 2 <= 180) {
    detectedBpm *= 2
  } else if (detectedBpm > 175 && detectedBpm / 2 >= 75) {
    detectedBpm /= 2
  }

  // Check if close to an integer tempo (within ±0.35 BPM) - most tracks are produced at integer BPMs
  const nearestInt = Math.round(detectedBpm)
  if (Math.abs(detectedBpm - nearestInt) < 0.35) {
    detectedBpm = nearestInt
  } else {
    detectedBpm = Math.round(detectedBpm * 10) / 10
  }

  // 6. Find first downbeat transient in the intro
  const beatIntervalSec = 60 / detectedBpm
  let firstBeatTime = 0
  let maxTransient = 0
  const searchWindow = Math.min(totalSamples, Math.floor(sampleRate * Math.min(10, beatIntervalSec * 8)))
  const chunkSize = Math.floor(sampleRate * 0.02) // 20ms chunks

  for (let i = 0; i < searchWindow - chunkSize; i += chunkSize) {
    let rms = 0
    for (let j = 0; j < chunkSize; j++) {
      const v = rawData[i + j]
      rms += v * v
    }
    rms = Math.sqrt(rms / chunkSize)
    if (rms > maxTransient) {
      maxTransient = rms
      firstBeatTime = i / sampleRate
    }
  }

  firstBeatTime = firstBeatTime % beatIntervalSec

  return {
    bpm: detectedBpm,
    firstBeatTime,
    confidence: maxCorr > 0 ? 0.9 : 0.5,
  }
}
