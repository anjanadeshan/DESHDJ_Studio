import React, { useRef, useState, useEffect, useCallback } from 'react'

interface JogWheelProps {
  isPlaying: boolean
  playbackRate: number
  vinylMode?: boolean
  color?: string
  deckId: 'A' | 'B' | 'C' | 'D'
  onStartScratch: () => void
  onScratch: (deltaSec: number, velocity: number) => void
  onStopScratch: () => void
  onNudge: (deltaRate: number) => void
}

export const JogWheel: React.FC<JogWheelProps> = ({
  isPlaying,
  playbackRate,
  vinylMode = true,
  color = '#00e5ff',
  deckId,
  onStartScratch,
  onScratch,
  onStopScratch,
  onNudge,
}) => {
  const [rotation, setRotation] = useState(0)
  const [isVinylGrabbing, setIsVinylGrabbing] = useState(false)
  const [isCDJInteracting, setIsCDJInteracting] = useState(false)
  const [isRimNudging, setIsRimNudging] = useState(false)

  const wheelRef = useRef<HTMLDivElement>(null)
  const lastAngleRef = useRef(0)
  const lastTimeRef = useRef(0)
  const animFrameRef = useRef<number | null>(null)

  // Smooth momentum-based pitch bend refs
  const targetNudgeRef = useRef(0)
  const currentNudgeRef = useRef(0)
  const lastSentNudgeRef = useRef(0)

  // 60 FPS continuous animation loop: rotation + smooth pitch bend physics
  useEffect(() => {
    let lastStamp = performance.now()

    const step = (now: number) => {
      const dt = Math.max(0.001, (now - lastStamp) / 1000)
      lastStamp = now

      // 1. Platter visual rotation
      if (isPlaying && !isVinylGrabbing) {
        // Effective playback rate includes pitch bend
        const effectiveRate = playbackRate + currentNudgeRef.current
        const deltaDeg = 200 * effectiveRate * dt
        setRotation((prev) => (prev + deltaDeg) % 360)
      }

      // 2. Smooth momentum pitch blend physics (exponential friction decay & lerp)
      if (Math.abs(targetNudgeRef.current) > 0.0005 || Math.abs(currentNudgeRef.current) > 0.0005) {
        // Smoothly interpolate current nudge towards target
        currentNudgeRef.current += (targetNudgeRef.current - currentNudgeRef.current) * 0.35

        // Natural momentum friction decay when hand slows down or releases
        targetNudgeRef.current *= 0.85

        if (Math.abs(currentNudgeRef.current) < 0.0005) {
          currentNudgeRef.current = 0
          targetNudgeRef.current = 0
        }

        // Notify parent if changed meaningfully
        if (Math.abs(currentNudgeRef.current - lastSentNudgeRef.current) > 0.0005 || currentNudgeRef.current === 0) {
          lastSentNudgeRef.current = currentNudgeRef.current
          onNudge(currentNudgeRef.current)
        }
      } else if (lastSentNudgeRef.current !== 0) {
        lastSentNudgeRef.current = 0
        currentNudgeRef.current = 0
        targetNudgeRef.current = 0
        onNudge(0)
      }

      animFrameRef.current = requestAnimationFrame(step)
    }

    animFrameRef.current = requestAnimationFrame(step)

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [isPlaying, isVinylGrabbing, playbackRate, onNudge])

  // Get pointer angle in degrees relative to wheel center
  const getAngle = useCallback((clientX: number, clientY: number) => {
    if (!wheelRef.current) return 0
    const rect = wheelRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const rad = Math.atan2(clientY - centerY, clientX - centerX)
    let deg = (rad * 180) / Math.PI
    if (deg < 0) deg += 360
    return deg
  }, [])

  // Platter pointer down
  const handlePlatterPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

    const angle = getAngle(e.clientX, e.clientY)
    lastAngleRef.current = angle
    lastTimeRef.current = performance.now()

    if (vinylMode) {
      setIsVinylGrabbing(true)
      onStartScratch()
    } else {
      setIsCDJInteracting(true)
      targetNudgeRef.current = 0
    }
  }

  const handlePlatterPointerMove = (e: React.PointerEvent) => {
    if (!isVinylGrabbing && !isCDJInteracting) return
    const now = performance.now()
    const currentAngle = getAngle(e.clientX, e.clientY)

    let deltaAngle = currentAngle - lastAngleRef.current
    if (deltaAngle > 180) deltaAngle -= 360
    if (deltaAngle < -180) deltaAngle += 360

    const dt = Math.max(0.005, (now - lastTimeRef.current) / 1000)

    if (vinylMode) {
      // In Vinyl Mode: direct scratch and needle scrub
      const degToSeconds = 1.8 / 360
      const deltaSec = deltaAngle * degToSeconds
      const velocity = (deltaAngle / dt) / 200

      setRotation((prev) => (prev + deltaAngle) % 360)
      onScratch(deltaSec, velocity)
    } else {
      // In CDJ Mode:
      if (isPlaying) {
        // While playing: silky-smooth momentum pitch bend (pitch blend) to catch the beat
        const angularVelocity = deltaAngle / dt // deg/sec
        // Map spin speed to pitch bend: ~250 deg/sec = +0.075 (+7.5% tempo bend)
        const bendAmount = Math.max(-0.25, Math.min(0.25, angularVelocity * 0.0003))
        targetNudgeRef.current = bendAmount
        setRotation((prev) => (prev + deltaAngle) % 360)
      } else {
        // While paused: frame-by-frame cue point search without starting playback!
        const frameSec = deltaAngle * (1.0 / 360)
        onScratch(frameSec, 0.4)
        setRotation((prev) => (prev + deltaAngle) % 360)
      }
    }

    lastAngleRef.current = currentAngle
    lastTimeRef.current = now
  }

  const handlePlatterPointerUp = (e: React.PointerEvent) => {
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }

    if (vinylMode) {
      setIsVinylGrabbing(false)
      onStopScratch()
    } else {
      setIsCDJInteracting(false)
      // Allow targetNudge to smoothly decay to 0 naturally in step loop
    }
  }

  // Outer rim pitch nudge handler
  const handleRimPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    setIsRimNudging(true)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    lastAngleRef.current = getAngle(e.clientX, e.clientY)
    lastTimeRef.current = performance.now()
  }

  const handleRimPointerMove = (e: React.PointerEvent) => {
    if (!isRimNudging) return
    const now = performance.now()
    const currentAngle = getAngle(e.clientX, e.clientY)
    let deltaAngle = currentAngle - lastAngleRef.current
    if (deltaAngle > 180) deltaAngle -= 360
    if (deltaAngle < -180) deltaAngle += 360

    const dt = Math.max(0.005, (now - lastTimeRef.current) / 1000)
    const angularVelocity = deltaAngle / dt
    targetNudgeRef.current = Math.max(-0.25, Math.min(0.25, angularVelocity * 0.0003))

    lastAngleRef.current = currentAngle
    lastTimeRef.current = now
  }

  const handleRimPointerUp = (e: React.PointerEvent) => {
    setIsRimNudging(false)
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    // targetNudge will decay smoothly via friction in physics loop
  }

  return (
    <div className="flex flex-col items-center justify-center p-1 select-none">
      {/* Outer Housing & Rim */}
      <div
        ref={wheelRef}
        onPointerDown={handleRimPointerDown}
        onPointerMove={handleRimPointerMove}
        onPointerUp={handleRimPointerUp}
        className="relative w-52 h-52 rounded-full bg-[#101218] p-2 border-2 border-[#2b3042] shadow-2xl flex items-center justify-center cursor-ew-resize group"
        title="Jog Wheel: Drag Center Vinyl to scratch/scrub, Outer Rim to pitch bend/nudge"
      >
        {/* Outer Dot Ring Ticks (CDJ rim dots) */}
        <div className="absolute inset-1.5 rounded-full border border-dashed border-[#373d52] opacity-60 pointer-events-none" />

        {/* Center Platter (Vinyl Platter) */}
        <div
          onPointerDown={handlePlatterPointerDown}
          onPointerMove={handlePlatterPointerMove}
          onPointerUp={handlePlatterPointerUp}
          className="relative w-42 h-42 rounded-full cursor-grab active:cursor-grabbing shadow-inner flex items-center justify-center transition-shadow"
          style={{
            background:
              'radial-gradient(circle, #0e1017 0%, #151821 40%, #0a0b0f 70%, #1f2330 100%)',
            boxShadow: (isVinylGrabbing || isCDJInteracting)
              ? `0 0 20px ${color}`
              : 'inset 0 0 12px rgba(0,0,0,0.85), 0 2px 6px rgba(0,0,0,0.7)',
          }}
        >
          {/* Vinyl Grooves Texture */}
          <div className="absolute inset-2 rounded-full border border-[#232733] opacity-40 pointer-events-none" />
          <div className="absolute inset-5 rounded-full border border-[#1e222d] opacity-40 pointer-events-none" />
          <div className="absolute inset-8 rounded-full border border-[#232733] opacity-40 pointer-events-none" />
          <div className="absolute inset-11 rounded-full border border-[#1e222d] opacity-40 pointer-events-none" />

          {/* Rotating Platter Marker & Center Label */}
          <div
            className="w-full h-full rounded-full flex items-center justify-center relative pointer-events-none"
            style={{
              transform: `rotate(${rotation}deg)`,
            }}
          >
            {/* Position Marker Needle Stripe */}
            <div
              className="absolute top-1 left-1/2 -translate-x-1/2 w-2 h-7 rounded-full shadow-sm"
              style={{
                backgroundColor: (isVinylGrabbing || isCDJInteracting) ? '#ffffff' : color,
                boxShadow: `0 0 8px ${color}`,
              }}
            />

            {/* Center Spindle Label */}
            <div
              className="w-16 h-16 rounded-full border border-[#3b4256] flex flex-col items-center justify-center shadow-lg"
              style={{
                background: 'radial-gradient(circle, #202432 0%, #0c0d12 100%)',
              }}
            >
              <span
                className="text-xs font-black tracking-wider"
                style={{ color }}
              >
                DECK {deckId}
              </span>
              <span
                className={`text-[8px] font-mono font-bold tracking-tighter ${
                  vinylMode ? 'text-[#00e5ff]' : 'text-neutral-400'
                }`}
              >
                {vinylMode ? 'VINYL' : 'CDJ'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
