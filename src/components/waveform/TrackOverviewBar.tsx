import React, { useRef } from 'react'
import type { DeckState } from '../../types/dj'

interface TrackOverviewBarProps {
  deck: DeckState
  onSeek: (time: number) => void
  color?: string
}

export const TrackOverviewBar: React.FC<TrackOverviewBarProps> = ({
  deck,
  onSeek,
  color = '#00e5ff',
}) => {
  const barRef = useRef<HTMLDivElement>(null)

  const duration = deck.duration || deck.track?.duration || 1
  const currentTime = deck.currentTime
  const progressPercent = Math.max(0, Math.min(100, (currentTime / duration) * 100))

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!barRef.current || !deck.track) return
    const rect = barRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percent = Math.max(0, Math.min(1, clickX / rect.width))
    onSeek(percent * duration)
  }

  const renderMiniWaveform = () => {
    if (!deck.track?.waveform) {
      return (
        <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-600 font-mono">
          NO TRACK LOADED
        </div>
      )
    }

    const { peaks, lowPeaks, midPeaks, length } = deck.track.waveform
    // Downsample to 120 bars for overview
    const barsCount = 100
    const step = Math.floor(length / barsCount)

    return (
      <div className="w-full h-full flex items-center justify-between px-1">
        {Array.from({ length: barsCount }).map((_, i) => {
          const idx = i * step
          const raw = peaks[idx] || 0.05
          const low = lowPeaks[idx] || 0
          const mid = midPeaks[idx] || 0

          let barColor = color
          if (low > 0.4) barColor = '#ef4444' // bass kick
          else if (mid > 0.3) barColor = '#22c55e' // vocal/mid

          const hPercent = Math.max(10, Math.min(95, raw * 95))

          return (
            <div
              key={i}
              className="w-[1.5px] rounded-[0.5px] opacity-70"
              style={{
                height: `${hPercent}%`,
                backgroundColor: barColor,
              }}
            />
          )
        })}
      </div>
    )
  }

  return (
    <div
      ref={barRef}
      onClick={handleClick}
      className="relative w-full h-7 bg-[#0b0c10] border border-[#232733] rounded-[3px] cursor-pointer overflow-hidden group select-none touch-none"
      style={{ touchAction: 'none' }}
      title="Click anywhere to seek track position"
    >
      {/* Waveform graphic */}
      {renderMiniWaveform()}

      {/* Elapsed shaded overlay */}
      <div
        className="absolute top-0 left-0 bottom-0 pointer-events-none transition-all duration-75"
        style={{
          width: `${progressPercent}%`,
          backgroundColor: color,
          opacity: 0.18,
        }}
      />

      {/* Playhead Needle Line */}
      {deck.track && (
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_6px_#fff] pointer-events-none transition-all duration-75"
          style={{ left: `${progressPercent}%` }}
        />
      )}

      {/* Hot Cue Markers */}
      {deck.hotCues.map((cueTime, idx) => {
        if (cueTime === null) return null
        const cuePercent = (cueTime / duration) * 100
        return (
          <div
            key={idx}
            className="absolute top-0 bottom-0 w-[1.5px] bg-amber-400 pointer-events-none"
            style={{ left: `${cuePercent}%` }}
          >
            <div className="w-1.5 h-1.5 bg-amber-400 rounded-full -translate-x-[2px] top-0 absolute" />
          </div>
        )
      })}

      {/* Active Loop Range */}
      {deck.loop.active && (
        <div
          className="absolute top-0 bottom-0 bg-amber-500/30 border-x border-amber-400 pointer-events-none"
          style={{
            left: `${(deck.loop.start / duration) * 100}%`,
            width: `${((deck.loop.end - deck.loop.start) / duration) * 100}%`,
          }}
        />
      )}
    </div>
  )
}

