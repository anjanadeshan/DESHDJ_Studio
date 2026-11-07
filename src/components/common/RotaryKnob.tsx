import React, { useRef, useState } from 'react'

interface RotaryKnobProps {
  label: string
  value: number // current value
  min: number
  max: number
  defaultValue?: number
  step?: number
  bipolar?: boolean // center = 0 (12 o'clock)
  size?: number
  color?: string
  unit?: string
  displayValue?: string
  onChange: (value: number) => void
}

export const RotaryKnob: React.FC<RotaryKnobProps> = ({
  label,
  value,
  min,
  max,
  defaultValue = 0,
  bipolar = false,
  size = 48,
  color = '#00e5ff',
  unit = '',
  displayValue,
  onChange,
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const dragStartY = useRef(0)
  const dragStartValue = useRef(0)
  const activePointerId = useRef<number | null>(null)

  // Map value to angle (-135 deg to +135 deg, 270 deg total range)
  // For bipolar knobs (EQs, Filter), value = 0 MUST be 0 deg (12 o'clock)!
  let angle = 0
  if (bipolar) {
    if (value <= 0) {
      const frac = min !== 0 ? value / Math.abs(min) : 0 // -1 to 0
      angle = Math.max(-135, Math.min(0, frac * 135))
    } else {
      const frac = max !== 0 ? value / max : 0 // 0 to 1
      angle = Math.max(0, Math.min(135, frac * 135))
    }
  } else {
    const range = max - min
    const norm = Math.max(0, Math.min(1, (value - min) / range))
    angle = -135 + norm * 270
  }

  // Pointer Down handles both mobile touch and desktop mouse clicks
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Prevent mobile page scrolling while turning knob
    e.preventDefault()
    setIsDragging(true)
    dragStartY.current = e.clientY
    dragStartValue.current = value
    activePointerId.current = e.pointerId

    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || activePointerId.current !== e.pointerId) return
    e.preventDefault()
    const deltaY = dragStartY.current - e.clientY // up is positive
    const range = max - min
    const sensitivity = e.shiftKey ? 0.001 : 0.0055
    const change = deltaY * range * sensitivity
    const next = Math.max(min, Math.min(max, dragStartValue.current + change))
    onChange(next)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current === e.pointerId) {
      setIsDragging(false)
      activePointerId.current = null
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // ignore
      }
    }
  }

  const handleDoubleClick = () => {
    onChange(defaultValue)
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const range = max - min
    const delta = -Math.sign(e.deltaY) * (range / 60)
    const next = Math.max(min, Math.min(max, value + delta))
    onChange(next)
  }

  // Compute SVG arc
  const radius = size * 0.4
  const center = size / 2

  const polarToCartesian = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180.0
    return {
      x: center + radius * Math.cos(rad),
      y: center + radius * Math.sin(rad),
    }
  }

  const arcStart = bipolar ? 0 : -135
  const arcEnd = angle

  const startPt = polarToCartesian(arcStart)
  const endPt = polarToCartesian(arcEnd)
  const largeArcFlag = Math.abs(arcEnd - arcStart) > 180 ? 1 : 0
  const sweepFlag = arcEnd >= arcStart ? 1 : 0
  const arcPath = `M ${startPt.x} ${startPt.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${endPt.x} ${endPt.y}`

  const bgStart = polarToCartesian(-135)
  const bgEnd = polarToCartesian(135)
  const bgArc = `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 1 1 ${bgEnd.x} ${bgEnd.y}`

  const formattedValue =
    displayValue !== undefined
      ? displayValue
      : `${value > 0 && bipolar ? '+' : ''}${value.toFixed(1)}${unit}`

  return (
    <div className="flex flex-col items-center select-none group touch-none">
      <div
        className="relative cursor-ns-resize flex items-center justify-center touch-none select-none"
        style={{ width: size, height: size, touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        title={`${label}: ${formattedValue} (Double-click to reset to 12 o'clock)`}
      >
        <svg width={size} height={size} className="overflow-visible pointer-events-none">
          {/* Background Track */}
          <path
            d={bgArc}
            fill="none"
            stroke="#1b1e28"
            strokeWidth={3}
            strokeLinecap="round"
          />

          {/* Center Detent 12 o'clock Tick for Bipolar Knobs */}
          {bipolar && (
            <line
              x1={center}
              y1={center - radius - 2}
              x2={center}
              y2={center - radius + 3}
              stroke="#525b75"
              strokeWidth={1.5}
            />
          )}

          {/* Active Value Arc */}
          {Math.abs(arcEnd - arcStart) > 1 && (
            <path
              d={arcPath}
              fill="none"
              stroke={color}
              strokeWidth={3.5}
              strokeLinecap="round"
              className="transition-all duration-75"
              style={{
                filter: isDragging ? `drop-shadow(0 0 4px ${color})` : undefined,
              }}
            />
          )}

          {/* Center Knob Face */}
          <circle
            cx={center}
            cy={center}
            r={radius - 4}
            fill="#12141a"
            stroke="#2b303f"
            strokeWidth={1.5}
          />

          {/* Indicator Dot/Line */}
          <line
            x1={center}
            y1={center}
            x2={center + (radius - 5) * Math.cos(((angle - 90) * Math.PI) / 180)}
            y2={center + (radius - 5) * Math.sin(((angle - 90) * Math.PI) / 180)}
            stroke={isDragging ? '#ffffff' : color}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </svg>
      </div>

      <span className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase mt-0.5 group-hover:text-neutral-200 pointer-events-none">
        {label}
      </span>
      <span className="text-[9px] font-mono text-neutral-500 font-medium pointer-events-none">
        {formattedValue}
      </span>
    </div>
  )
}
