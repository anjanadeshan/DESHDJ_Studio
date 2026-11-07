import React, { useRef, useEffect, useState, useCallback } from 'react'
import type { DeckState } from '../../types/dj'

interface StackedWaveformsProps {
  deckA: DeckState
  deckB: DeckState
  getCurrentTimeA: () => number
  getCurrentTimeB: () => number
  onSeekA: (time: number) => void
  onSeekB: (time: number) => void
}

export const StackedWaveforms: React.FC<StackedWaveformsProps> = ({
  deckA,
  deckB,
  getCurrentTimeA,
  getCurrentTimeB,
  onSeekA,
  onSeekB,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [zoom, setZoom] = useState(1.0)
  const isDraggingRef = useRef<{ deck: 'A' | 'B'; startX: number; startTime: number } | null>(null)

  const drawWaveformDeck = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      deck: DeckState,
      currentTime: number,
      topY: number,
      height: number,
      width: number
    ) => {
      const centerY = topY + height / 2

      // Deck background
      ctx.fillStyle = deck.id === 'A' ? '#0b0d14' : '#0a0c12'
      ctx.fillRect(0, topY, width, height)

      // Center baseline
      ctx.strokeStyle = '#1a1e2b'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, centerY)
      ctx.lineTo(width, centerY)
      ctx.stroke()

      if (!deck.track || !deck.track.waveform) {
        ctx.fillStyle = '#4b5563'
        ctx.font = 'bold 12px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(
          `DECK ${deck.id}: NO TRACK LOADED (Drop audio file or click Browse Library)`,
          width / 2,
          centerY + 4
        )
        return
      }

      const wf = deck.track.waveform
      const duration = deck.duration || deck.track.duration || 1
      const visibleSeconds = 12 / zoom
      const pxPerSec = (width / 2) / visibleSeconds
      const playheadX = width / 2

      // 1. Draw Beatgrid Lines
      if (deck.track.bpm > 0) {
        const beatInterval = 60 / deck.track.bpm
        const startSec = Math.max(0, currentTime - visibleSeconds)
        const endSec = Math.min(duration, currentTime + visibleSeconds)

        const firstBeatIdx = Math.floor(startSec / beatInterval)
        const lastBeatIdx = Math.ceil(endSec / beatInterval)

        for (let b = firstBeatIdx; b <= lastBeatIdx; b++) {
          const beatTime = b * beatInterval
          const x = playheadX + (beatTime - currentTime) * pxPerSec

          if (x >= 0 && x <= width) {
            const isBar = b % 4 === 0
            ctx.strokeStyle = isBar
              ? deck.id === 'A'
                ? 'rgba(0, 229, 255, 0.45)'
                : 'rgba(255, 51, 102, 0.45)'
              : 'rgba(75, 85, 99, 0.25)'
            ctx.lineWidth = isBar ? 1.5 : 1
            ctx.beginPath()
            ctx.moveTo(x, topY)
            ctx.lineTo(x, topY + height)
            ctx.stroke()

            if (isBar && x > 20 && x < width - 20) {
              ctx.fillStyle = deck.id === 'A' ? '#00e5ff' : '#ff3366'
              ctx.font = 'bold 9px monospace'
              ctx.textAlign = 'center'
              ctx.fillText(`${Math.floor(b / 4) + 1}`, x, topY + 12)
            }
          }
        }
      }

      // 2. Draw Active Loop Region
      if (deck.loop.active) {
        const loopStartX = playheadX + (deck.loop.start - currentTime) * pxPerSec
        const loopEndX = playheadX + (deck.loop.end - currentTime) * pxPerSec

        if (loopEndX >= 0 && loopStartX <= width) {
          ctx.fillStyle = 'rgba(245, 158, 11, 0.22)'
          const renderStart = Math.max(0, loopStartX)
          const renderEnd = Math.min(width, loopEndX)
          ctx.fillRect(renderStart, topY, renderEnd - renderStart, height)

          ctx.strokeStyle = '#f59e0b'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(loopStartX, topY)
          ctx.lineTo(loopStartX, topY + height)
          ctx.moveTo(loopEndX, topY)
          ctx.lineTo(loopEndX, topY + height)
          ctx.stroke()
        }
      }

      // 3. Render High-Definition 3-Band Frequency Waveforms
      const totalPoints = wf.length
      const halfH = height * 0.46
      const startVisibleSec = currentTime - visibleSeconds

      // Step by 2 pixels for crisp rendering
      for (let x = 0; x < width; x += 2) {
        const timeAtX = startVisibleSec + (x / width) * (visibleSeconds * 2)
        if (timeAtX < 0 || timeAtX > duration) continue

        const progress = timeAtX / duration
        const idx = Math.floor(progress * totalPoints)
        if (idx < 0 || idx >= totalPoints) continue

        const lowVal = wf.lowPeaks[idx]
        const midVal = wf.midPeaks[idx]
        const highVal = wf.highPeaks[idx]
        const peakVal = wf.peaks[idx]

        // Highs / Air: Cyan/Magenta outer layer
        if (highVal > 0.02 || peakVal > 0.05) {
          const h = Math.max(peakVal, highVal) * halfH
          ctx.fillStyle = deck.id === 'A' ? 'rgba(0, 229, 255, 0.65)' : 'rgba(236, 72, 153, 0.65)'
          ctx.fillRect(x, centerY - h, 2, h * 2)
        }

        // Mids / Vocals: Emerald Green layer
        if (midVal > 0.02) {
          const h = midVal * halfH * 0.8
          ctx.fillStyle = 'rgba(34, 197, 94, 0.85)'
          ctx.fillRect(x, centerY - h, 2, h * 2)
        }

        // Lows / Kick / Bass: Punchy Red/Amber core
        if (lowVal > 0.02) {
          const h = lowVal * halfH * 0.6
          ctx.fillStyle = deck.id === 'A' ? 'rgba(255, 68, 68, 0.95)' : 'rgba(255, 120, 30, 0.95)'
          ctx.fillRect(x, centerY - h, 2, h * 2)
        }
      }

      // 4. Hot Cue Flag Markers
      deck.hotCues.forEach((cueTime, cueIdx) => {
        if (cueTime === null) return
        const x = playheadX + (cueTime - currentTime) * pxPerSec
        if (x >= -20 && x <= width + 20) {
          const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899']
          const color = colors[cueIdx % colors.length]

          ctx.strokeStyle = color
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(x, topY)
          ctx.lineTo(x, topY + height)
          ctx.stroke()

          ctx.fillStyle = color
          const badgeY = deck.id === 'A' ? topY + 2 : topY + height - 16
          ctx.beginPath()
          ctx.rect(x - 7, badgeY, 14, 14)
          ctx.fill()

          ctx.fillStyle = '#ffffff'
          ctx.font = 'bold 9px system-ui, sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(`${cueIdx + 1}`, x, badgeY + 10)
        }
      })

      // Deck ID Badge
      ctx.fillStyle = deck.id === 'A' ? '#00e5ff' : '#ff3366'
      ctx.font = 'bold 11px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(`DECK ${deck.id}`, 12, topY + 16)
    },
    [zoom]
  )

  // 60 FPS Render Loop pulling currentTime directly from audio nodes
  useEffect(() => {
    let animId: number
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const render = () => {
      const width = canvas.width
      const height = canvas.height
      const halfH = height / 2

      ctx.clearRect(0, 0, width, height)

      // Query real-time playhead positions directly
      const timeA = getCurrentTimeA()
      const timeB = getCurrentTimeB()

      // Deck A (Top Half)
      drawWaveformDeck(ctx, deckA, timeA, 0, halfH, width)

      // Deck B (Bottom Half)
      drawWaveformDeck(ctx, deckB, timeB, halfH, halfH, width)

      // Center Synchronized Playhead Line
      const playheadX = width / 2
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(playheadX, 0)
      ctx.lineTo(playheadX, height)
      ctx.stroke()

      // Center Playhead Triangular Pointer Heads
      ctx.fillStyle = '#ffffff'
      // Top indicator
      ctx.beginPath()
      ctx.moveTo(playheadX - 6, 0)
      ctx.lineTo(playheadX + 6, 0)
      ctx.lineTo(playheadX, 8)
      ctx.fill()

      // Center divider arrows
      ctx.beginPath()
      ctx.moveTo(playheadX - 5, halfH - 6)
      ctx.lineTo(playheadX + 5, halfH - 6)
      ctx.lineTo(playheadX, halfH)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(playheadX - 5, halfH + 6)
      ctx.lineTo(playheadX + 5, halfH + 6)
      ctx.lineTo(playheadX, halfH)
      ctx.fill()

      animId = requestAnimationFrame(render)
    }

    render()

    return () => cancelAnimationFrame(animId)
  }, [deckA, deckB, getCurrentTimeA, getCurrentTimeB, drawWaveformDeck])

  // Sharp canvas resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current
      if (canvas && canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth
        canvas.height = 180
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Drag to scrub
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const y = e.clientY - rect.top
    const deck = y < canvas.height / 2 ? 'A' : 'B'
    const targetDeck = deck === 'A' ? deckA : deckB
    const currentTime = deck === 'A' ? getCurrentTimeA() : getCurrentTimeB()

    if (!targetDeck.track) return

    isDraggingRef.current = {
      deck,
      startX: e.clientX,
      startTime: currentTime,
    }
    canvas.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current || !canvasRef.current) return
    const { deck, startX, startTime } = isDraggingRef.current
    const targetDeck = deck === 'A' ? deckA : deckB
    if (!targetDeck.track) return

    const deltaX = startX - e.clientX
    const visibleSeconds = 12 / zoom
    const pxPerSec = (canvasRef.current.width / 2) / visibleSeconds
    const deltaSec = deltaX / pxPerSec

    const newTime = Math.max(0, Math.min(targetDeck.duration, startTime + deltaSec))
    if (deck === 'A') onSeekA(newTime)
    else onSeekB(newTime)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = null
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative w-full bg-[#0a0b0e] border-y border-[#202534] shadow-inner select-none rounded-md overflow-hidden">
      {/* Zoom controls */}
      <div className="absolute right-2 top-2 z-10 flex gap-1 bg-[#13151b]/85 backdrop-blur rounded p-0.5 border border-[#2b3040]">
        <button
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
          className="px-2 py-0.5 text-[10px] font-mono text-neutral-300 hover:text-white hover:bg-neutral-700/50 rounded font-bold"
          title="Zoom Out"
        >
          -
        </button>
        <span className="text-[10px] font-mono text-neutral-400 px-1 py-0.5">
          {zoom.toFixed(1)}x
        </span>
        <button
          onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}
          className="px-2 py-0.5 text-[10px] font-mono text-neutral-300 hover:text-white hover:bg-neutral-700/50 rounded font-bold"
          title="Zoom In"
        >
          +
        </button>
      </div>

      <canvas
        ref={canvasRef}
        height={180}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-full cursor-grab active:cursor-grabbing block"
      />
    </div>
  )
}
