import React from 'react'

interface VUMeterProps {
  level: { left: number; right: number } // 0.0 to 1.0
  height?: number
  segments?: number
  stereo?: boolean
}

export const VUMeter: React.FC<VUMeterProps> = ({
  level,
  height = 120,
  segments = 14,
  stereo = true,
}) => {
  const renderChannel = (val: number) => {
    const activeSegments = Math.round(Math.max(0, Math.min(1, val)) * segments)

    return (
      <div
        className="flex flex-col-reverse justify-between bg-[#0a0b0f] p-[1.5px] rounded-[2px] border border-[#1e222d]"
        style={{ height, width: 6 }}
      >
        {Array.from({ length: segments }).map((_, i) => {
          const isActive = i < activeSegments
          // Colors: top 2 red, next 3 amber, rest green
          let colorClass = 'bg-[#1b4332]'
          let activeClass = 'bg-[#22c55e] shadow-[0_0_4px_#22c55e]'

          if (i >= segments - 2) {
            // Peak / Clip Red
            colorClass = 'bg-[#4a1515]'
            activeClass = 'bg-[#ef4444] shadow-[0_0_4px_#ef4444]'
          } else if (i >= segments - 5) {
            // Headroom Amber
            colorClass = 'bg-[#4d3608]'
            activeClass = 'bg-[#f59e0b] shadow-[0_0_4px_#f59e0b]'
          }

          return (
            <div
              key={i}
              className={`w-full h-[4px] rounded-[1px] transition-colors duration-75 ${
                isActive ? activeClass : colorClass
              }`}
            />
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex gap-[2px] items-center">
      {renderChannel(level.left)}
      {stereo && renderChannel(level.right)}
    </div>
  )
}

