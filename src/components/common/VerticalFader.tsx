import React, { useRef, useState } from 'react'

interface VerticalFaderProps {
  value: number // normalized 0 to 1 or custom range
  min?: number
  max?: number
  defaultValue?: number
  height?: number
  width?: number
  color?: string
  label?: string
  showScale?: boolean
  scaleLabels?: string[]
  displayValue?: string
  onChange: (value: number) => void
}

export const VerticalFader: React.FC<VerticalFaderProps> = ({
  value,
  min = 0,
  max = 1,
  defaultValue = 0.8,
  height = 140,
  width = 36,
  color = '#00e5ff',
  label,
  showScale = true,
  scaleLabels = ['+6', '0', '-6', '-12', '-inf'],
  displayValue,
  onChange,
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)

  const range = max - min
  const normalized = Math.max(0, Math.min(1, (value - min) / range))
  // In vertical faders, bottom is min (normalized=0), top is max (normalized=1)
  const thumbBottomPercent = normalized * 100

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    setIsDragging(true)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    updateFromPointer(e.clientY)
  }

  const updateFromPointer = (clientY: number) => {
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    // calculate from bottom of track
    const offsetFromBottom = rect.bottom - clientY
    const norm = Math.max(0, Math.min(1, offsetFromBottom / rect.height))
    const next = min + norm * range
    onChange(next)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    updateFromPointer(e.clientY)
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
    onChange(defaultValue)
  }

  return (
    <div className="flex flex-col items-center select-none">
      <div className="flex items-center gap-1.5">
        {/* Scale tick marks */}
        {showScale && (
          <div
            className="flex flex-col justify-between text-[8px] font-mono text-neutral-500 py-1"
            style={{ height }}
          >
            {scaleLabels.map((lbl, idx) => (
              <span key={idx} className="leading-none text-right">
                {lbl}
              </span>
            ))}
          </div>
        )}

        {/* Fader Track */}
        <div
          ref={trackRef}
          className="relative cursor-pointer flex justify-center py-2 group"
          style={{ height, width }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={handleDoubleClick}
          title={`${label || 'Fader'}: ${displayValue || value.toFixed(2)} (Double-click to reset)`}
        >
          {/* Track Slot */}
          <div className="w-1.5 h-full bg-[#0a0b0f] rounded-full border border-[#232733] relative">
            {/* Center Zero Tick */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-[1px] bg-neutral-600 pointer-events-none" />

            {/* Filled track level */}
            <div
              className="absolute bottom-0 left-0 w-full rounded-full transition-all duration-75"
              style={{
                height: `${thumbBottomPercent}%`,
                backgroundColor: color,
                opacity: 0.35,
              }}
            />
          </div>

          {/* Fader Thumb Cap */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-8 h-5 rounded-[4px] bg-gradient-to-b from-[#2a2d38] via-[#1a1d24] to-[#121419] border border-[#3e4453] shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing transition-transform"
            style={{
              bottom: `calc(${thumbBottomPercent}% - 10px)`,
              boxShadow: isDragging ? `0 0 8px ${color}` : undefined,
            }}
          >
            {/* Center line on cap */}
            <div
              className="w-5 h-[2px] rounded-full"
              style={{ backgroundColor: isDragging ? color : '#e2e8f0' }}
            />
          </div>
        </div>
      </div>

      {label && (
        <span className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase mt-1">
          {label}
        </span>
      )}
      {displayValue && (
        <span className="text-[9px] font-mono text-neutral-500 font-medium">
          {displayValue}
        </span>
      )}
    </div>
  )
}
