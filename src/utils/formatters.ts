export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const hundredths = Math.floor((seconds % 1) * 100)

  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`
}

export function formatBpm(bpm: number): string {
  if (!bpm || isNaN(bpm)) return '---.-'
  return bpm.toFixed(1)
}

export function formatPitchPercent(offsetPercent: number): string {
  const sign = offsetPercent > 0 ? '+' : ''
  return `${sign}${offsetPercent.toFixed(2)}%`
}

export function formatLoopBeats(beats: number): string {
  if (beats === 0.03125) return '1/32'
  if (beats === 0.0625) return '1/16'
  if (beats === 0.125) return '1/8'
  if (beats === 0.25) return '1/4'
  if (beats === 0.5) return '1/2'
  if (beats >= 1) return `${beats}`
  return `${beats}`
}

