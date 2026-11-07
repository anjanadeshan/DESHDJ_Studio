import React, { useState } from 'react'
import type { LoopState } from '../../types/dj'
import { formatLoopBeats } from '../../utils/formatters'

interface PerformancePadsProps {
  hotCues: (number | null)[]
  currentTime: number
  bpm: number
  loop: LoopState
  color?: string
  onSetHotCue: (index: number) => void
  onClearHotCue: (index: number) => void
  onTriggerLoop: (beats: number) => void
  onToggleLoop: () => void
  onHalveLoop: () => void
  onDoubleLoop: () => void
  onLoopIn: () => void
  onLoopOut: () => void
}

type PadMode = 'hotcue' | 'loop'

const CUE_COLORS = [
  '#ef4444', // 1: Red
  '#f97316', // 2: Orange
  '#eab308', // 3: Yellow
  '#22c55e', // 4: Green
  '#06b6d4', // 5: Cyan
  '#3b82f6', // 6: Blue
  '#a855f7', // 7: Purple
  '#ec4899', // 8: Pink
]

const LOOP_SIZES = [0.125, 0.25, 0.5, 1, 2, 4, 8, 16]

export const PerformancePads: React.FC<PerformancePadsProps> = ({
  hotCues,
  loop,
  onSetHotCue,
  onClearHotCue,
  onTriggerLoop,
  onToggleLoop,
  onHalveLoop,
  onDoubleLoop,
  onLoopIn,
  onLoopOut,
}) => {
  const [mode, setMode] = useState<PadMode>('hotcue')

  const handleCueClick = (index: number, e: React.MouseEvent) => {
    if (e.shiftKey) {
      onClearHotCue(index)
    } else {
      onSetHotCue(index)
    }
  }

  return (
    <div className="flex flex-col bg-[#11131a] p-2 rounded-md border border-[#202431] gap-2 select-none">
      {/* Mode Selectors & Loop Bar */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex gap-1">
          <button
            onClick={() => setMode('hotcue')}
            className={`px-2 py-0.5 text-[9px] font-bold rounded transition-all ${
              mode === 'hotcue'
                ? 'bg-neutral-200 text-black shadow-sm'
                : 'bg-[#181a24] text-neutral-400 hover:text-white'
            }`}
          >
            HOT CUE
          </button>
          <button
            onClick={() => setMode('loop')}
            className={`px-2 py-0.5 text-[9px] font-bold rounded transition-all ${
              mode === 'loop'
                ? 'bg-amber-400 text-black shadow-sm'
                : 'bg-[#181a24] text-neutral-400 hover:text-white'
            }`}
          >
            AUTO LOOP
          </button>
        </div>

        {/* Loop Controls Bar */}
        <div className="flex items-center gap-1.5 text-[10px] font-mono">
          {/* Loop In / Loop Cue */}
          <button
            onClick={onLoopIn}
            className={`px-2 py-0.5 rounded border font-bold transition-all cursor-pointer active:scale-95 ${
              loop.active
                ? 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                : 'bg-[#1a1d28] hover:bg-[#252a3b] text-neutral-300 border-[#2c3244]'
            }`}
            title={loop.active ? 'Loop Cue: Jump to Loop In Point' : 'Set Manual Loop In Point'}
          >
            IN
          </button>

          {/* Smart Loop Out / Exit Button */}
          <button
            onClick={onLoopOut}
            className={`px-2.5 py-0.5 rounded border font-bold transition-all cursor-pointer active:scale-95 flex items-center gap-1 ${
              loop.active
                ? 'bg-amber-500 text-black border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.7)] animate-pulse'
                : 'bg-[#1a1d28] hover:bg-[#252a3b] text-neutral-300 border-[#2c3244]'
            }`}
            title={loop.active ? 'EXIT LOOP (Continue Playback)' : 'Close & Quantize Smart Loop'}
          >
            {loop.active ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
                <span>EXIT</span>
              </>
            ) : (
              <span>OUT</span>
            )}
          </button>

          {/* Reloop / Active Indicator */}
          <button
            onClick={onToggleLoop}
            className={`px-2 py-0.5 font-bold rounded border transition-all cursor-pointer active:scale-95 ${
              loop.active
                ? 'bg-amber-400/20 text-amber-300 border-amber-400/60'
                : loop.end > loop.start
                ? 'bg-[#1a1d28] hover:bg-[#252a3b] text-amber-400 border-amber-500/40'
                : 'bg-[#1a1d28] text-neutral-500 border-[#2c3244] opacity-50'
            }`}
            title={loop.active ? 'Exit Loop' : 'Reloop Stored Loop'}
          >
            {loop.active ? `${formatLoopBeats(loop.beats)}B ACTIVE` : 'RELOOP'}
          </button>

          {/* Loop Beat Multipliers: 1/2x & 2x */}
          <div className="flex items-center gap-0.5 ml-auto">
            <button
              onClick={onHalveLoop}
              disabled={!loop.active}
              className="px-1.5 py-0.5 bg-[#1a1d28] hover:bg-[#252a3b] text-neutral-300 rounded border border-[#2c3244] disabled:opacity-40 disabled:cursor-not-allowed font-bold"
              title="Halve Loop (1/2x)"
            >
              ½
            </button>
            <button
              onClick={onDoubleLoop}
              disabled={!loop.active}
              className="px-1.5 py-0.5 bg-[#1a1d28] hover:bg-[#252a3b] text-neutral-300 rounded border border-[#2c3244] disabled:opacity-40 disabled:cursor-not-allowed font-bold"
              title="Double Loop (2x)"
            >
              2×
            </button>
          </div>
        </div>
      </div>

      {/* 8 Performance Pads Grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {mode === 'hotcue'
          ? Array.from({ length: 8 }).map((_, i) => {
              const hasCue = hotCues[i] !== null && hotCues[i] !== undefined
              const padColor = CUE_COLORS[i]

              return (
                <button
                  key={i}
                  onClick={(e) => handleCueClick(i, e)}
                  className="h-10 rounded-[3px] border border-[#2a2f40] flex flex-col items-center justify-center font-bold text-xs transition-all active:scale-95 group relative overflow-hidden"
                  style={{
                    backgroundColor: hasCue ? padColor : '#161922',
                    color: hasCue ? '#ffffff' : '#9ca3af',
                    boxShadow: hasCue ? `0 0 8px ${padColor}80` : undefined,
                  }}
                  title={`Hot Cue ${i + 1} (Click to set/jump, Shift+Click to delete)`}
                >
                  <span className="text-xs font-bold leading-none">{i + 1}</span>
                  <span className="text-[8px] font-mono opacity-80 mt-0.5">
                    {hasCue ? `${hotCues[i]?.toFixed(1)}s` : 'EMPTY'}
                  </span>
                </button>
              )
            })
          : LOOP_SIZES.map((beats, i) => {
              const isSelected = loop.active && loop.beats === beats

              return (
                <button
                  key={i}
                  onClick={() => onTriggerLoop(beats)}
                  className={`h-10 rounded-[3px] border flex flex-col items-center justify-center font-bold text-xs transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-amber-400 text-black border-amber-300 shadow-[0_0_10px_#f59e0b]'
                      : 'bg-[#161922] text-neutral-300 border-[#2a2f40] hover:bg-[#202431]'
                  }`}
                  title={`Loop ${formatLoopBeats(beats)} Beats`}
                >
                  <span className="font-mono text-sm leading-none">
                    {formatLoopBeats(beats)}
                  </span>
                  <span className="text-[7px] text-neutral-400 mt-0.5">BEAT</span>
                </button>
              )
            })}
      </div>
    </div>
  )
}
