import React, { useRef, useState } from 'react'
import type { CrossfaderCurve } from '../../types/dj'

interface CrossfaderProps {
  value: number // -1 (A) to +1 (B)
  curve: CrossfaderCurve
  onChange: (value: number) => void
  onChangeCurve: (curve: CrossfaderCurve) => void
}

export const Crossfader: React.FC<CrossfaderProps> = ({
  value,
  curve,
  onChange,
  onChangeCurve,
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)

  // Map value (-1 to +1) to percentage (0% to 100%)
  const percent = ((value + 1) / 2) * 100

  const updateFromPointer = (clientX: number) => {
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const offsetX = clientX - rect.left
    const norm = Math.max(0, Math.min(1, offsetX / rect.width))
    const nextValue = norm * 2 - 1
    onChange(nextValue)
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    setIsDragging(true)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    updateFromPointer(e.clientX)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    updateFromPointer(e.clientX)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false)
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  const handleDoubleClick = () => {
    onChange(0) // Center
  }

  return (
    <div className="flex flex-col items-center bg-[#0c0d13] p-2.5 rounded-lg border border-[#202432] gap-1.5 select-none w-full max-w-[280px]">
      {/* Header & Curve Selector */}
      <div className="flex items-center justify-between w-full text-[9px] font-bold font-mono text-neutral-400">
        <span className="text-[#00e5ff]">DECK A</span>

        <div className="flex bg-[#141620] rounded p-0.5 border border-[#232734]">
          <button
            onClick={() => onChangeCurve('smooth')}
            className={`px-2 py-0.5 rounded transition-all ${
              curve === 'smooth'
                ? 'bg-neutral-200 text-black shadow-sm'
                : 'text-neutral-500 hover:text-white'
            }`}
            title="Smooth constant-power mix curve"
          >
            SMOOTH
          </button>
          <button
            onClick={() => onChangeCurve('cut')}
            className={`px-2 py-0.5 rounded transition-all ${
              curve === 'cut'
                ? 'bg-[#ff3366] text-white shadow-sm'
                : 'text-neutral-500 hover:text-white'
            }`}
            title="Sharp fast-cut scratch curve"
          >
            CUT
          </button>
        </div>

        <span className="text-[#ff3366]">DECK B</span>
      </div>

      {/* Horizontal Crossfader Track */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        className="relative w-full h-8 flex items-center cursor-pointer group py-1 touch-none select-none"
        style={{ touchAction: 'none' }}
        title="Crossfader (Double-click to center, Hotkeys: X, C, V)"
      >
        {/* Track Slot */}
        <div className="w-full h-2 bg-[#08090d] rounded-full border border-[#202431] relative">
          {/* Center Mark */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[2px] h-3.5 bg-neutral-600 pointer-events-none" />
        </div>

        {/* Fader Knob Cap */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-8 rounded-[4px] bg-gradient-to-b from-[#2e323e] via-[#1a1d26] to-[#12141c] border border-[#444a5d] shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing transition-shadow"
          style={{
            left: `${percent}%`,
            boxShadow: isDragging
              ? '0 0 10px rgba(255, 255, 255, 0.4)'
              : '0 2px 5px rgba(0,0,0,0.6)',
          }}
        >
          {/* Center Line on Cap */}
          <div className="w-[2px] h-5 bg-white rounded-full opacity-90" />
        </div>
      </div>

      {/* Hotkey Guide */}
      <div className="flex items-center justify-between w-full text-[8px] font-mono text-neutral-500">
        <button
          onClick={() => onChange(-1)}
          className="hover:text-neutral-300 cursor-pointer"
        >
          [X] Left
        </button>
        <button
          onClick={() => onChange(0)}
          className="hover:text-neutral-300 cursor-pointer"
        >
          [C] Center
        </button>
        <button
          onClick={() => onChange(1)}
          className="hover:text-neutral-300 cursor-pointer"
        >
          [V] Right
        </button>
      </div>
    </div>
  )
}
