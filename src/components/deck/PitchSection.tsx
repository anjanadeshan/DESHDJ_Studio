import React from 'react'
import { VerticalFader } from '../common/VerticalFader'
import { formatBpm, formatPitchPercent } from '../../utils/formatters'

interface PitchSectionProps {
  bpm: number
  originalBpm: number
  pitchOffset: number // e.g. -8.0 to +8.0
  pitchRange: 6 | 10 | 16 | 100
  keyLock: boolean
  isSync: boolean
  color?: string
  onPitchChange: (offset: number) => void
  onPitchRangeCycle: () => void
  onKeyLockToggle: () => void
  onSyncToggle: () => void
  onPitchBend: (direction: -1 | 1 | 0) => void
}

export const PitchSection: React.FC<PitchSectionProps> = ({
  bpm,
  originalBpm,
  pitchOffset,
  pitchRange,
  keyLock,
  isSync,
  color = '#00e5ff',
  onPitchChange,
  onPitchRangeCycle,
  onKeyLockToggle,
  onSyncToggle,
  onPitchBend,
}) => {
  const normalized = (pitchOffset + pitchRange) / (pitchRange * 2)

  const handleFaderChange = (norm: number) => {
    const nextOffset = -pitchRange + norm * (pitchRange * 2)
    onPitchChange(nextOffset)
  }

  return (
    <div className="flex flex-col items-center bg-[#101218] p-2 rounded-lg border border-[#202431] gap-2 select-none">
      {/* Top Controls: SYNC & Master Tempo (Key Lock) */}
      <div className="flex items-center gap-1.5 w-full justify-between">
        <button
          onClick={onSyncToggle}
          className={`flex-1 py-1 text-[10px] font-bold tracking-wider rounded border transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1 ${
            isSync
              ? 'bg-[#22c55e] text-black border-[#22c55e] shadow-[0_0_10px_#22c55e]'
              : 'bg-[#181a24] text-neutral-400 border-[#2a2f3f] hover:text-white'
          }`}
          title="Instant BPM & Beat Sync (Click to toggle ON/OFF)"
        >
          {isSync && <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />}
          <span>SYNC</span>
        </button>

        <button
          onClick={onKeyLockToggle}
          className={`px-2 py-1 text-[9px] font-bold rounded border transition-all cursor-pointer ${
            keyLock
              ? 'bg-[#0ea5e9] text-black border-[#0ea5e9] shadow-[0_0_6px_#0ea5e9]'
              : 'bg-[#181a24] text-neutral-400 border-[#2a2f3f] hover:text-white'
          }`}
          title="Master Tempo (Key Lock): Lock musical pitch when changing tempo"
        >
          KEY LOCK
        </button>
      </div>

      {/* BPM & Range Readout */}
      <div className="flex flex-col items-center bg-[#090a0e] px-2 py-1.5 rounded w-full border border-[#1b1e28]">
        <div className="flex items-baseline gap-1">
          <span className="text-base font-black font-mono text-white tracking-wide">
            {formatBpm(bpm)}
          </span>
          <span className="text-[9px] font-mono text-neutral-500">BPM</span>
        </div>

        <div className="flex items-center justify-between w-full text-[9px] font-mono text-neutral-400 mt-0.5">
          <span>{formatPitchPercent(pitchOffset)}</span>
          <span className="text-neutral-500 text-[8px]">({formatBpm(originalBpm)})</span>
          <button
            onClick={onPitchRangeCycle}
            className="hover:text-white underline cursor-pointer"
            title="Cycle Pitch Range (+/- 6%, 10%, 16%, 100%)"
          >
            ±{pitchRange}%
          </button>
        </div>
      </div>

      {/* Vertical Pitch Fader */}
      <div className="py-1">
        <VerticalFader
          value={normalized}
          min={0}
          max={1}
          defaultValue={0.5}
          height={125}
          width={34}
          color={color}
          showScale={true}
          scaleLabels={[`+${pitchRange}`, '0', `-${pitchRange}`]}
          displayValue={formatPitchPercent(pitchOffset)}
          onChange={handleFaderChange}
        />
      </div>

      {/* Pitch Bend Buttons */}
      <div className="flex items-center gap-1.5 w-full justify-center">
        <button
          onPointerDown={() => onPitchBend(-1)}
          onPointerUp={() => onPitchBend(0)}
          className="flex-1 py-1 text-xs font-mono font-bold bg-[#181b24] text-neutral-300 rounded border border-[#2b3040] hover:bg-[#232736] active:bg-[#00e5ff] active:text-black cursor-pointer"
          title="Pitch Bend Down (Temporary slowdown)"
        >
          -
        </button>
        <button
          onPointerDown={() => onPitchBend(1)}
          onPointerUp={() => onPitchBend(0)}
          className="flex-1 py-1 text-xs font-mono font-bold bg-[#181b24] text-neutral-300 rounded border border-[#2b3040] hover:bg-[#232736] active:bg-[#00e5ff] active:text-black cursor-pointer"
          title="Pitch Bend Up (Temporary speedup)"
        >
          +
        </button>
      </div>
    </div>
  )
}
