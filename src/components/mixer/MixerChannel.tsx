import React from 'react'
import type { DeckId, EQState } from '../../types/dj'
import { RotaryKnob } from '../common/RotaryKnob'
import { VerticalFader } from '../common/VerticalFader'
import { VUMeter } from '../common/VUMeter'
import { Headphones } from 'lucide-react'

interface MixerChannelProps {
  id: DeckId
  eq: EQState
  filter: number // -1 to +1
  trim: number // 0 to 2
  volume: number // 0 to 1
  level: { left: number; right: number }
  cue: boolean
  crossfaderAssign: 'A' | 'THRU' | 'B'
  color?: string
  onChangeEQ: (eq: EQState) => void
  onChangeFilter: (val: number) => void
  onChangeTrim: (val: number) => void
  onChangeVolume: (val: number) => void
  onToggleCue: () => void
  onChangeCrossfaderAssign: (assign: 'A' | 'THRU' | 'B') => void
}

export const MixerChannel: React.FC<MixerChannelProps> = ({
  id,
  eq,
  filter,
  trim,
  volume,
  level,
  cue,
  crossfaderAssign,
  color = '#00e5ff',
  onChangeEQ,
  onChangeFilter,
  onChangeTrim,
  onChangeVolume,
  onToggleCue,
  onChangeCrossfaderAssign,
}) => {
  const handleEqChange = (band: 'high' | 'mid' | 'low', val: number) => {
    onChangeEQ({ ...eq, [band]: val })
  }

  const handleKillToggle = (band: 'high' | 'mid' | 'low') => {
    const key = `${band}Kill` as 'highKill' | 'midKill' | 'lowKill'
    onChangeEQ({ ...eq, [key]: !eq[key] })
  }

  return (
    <div className="flex flex-col items-center bg-[#0e1017] p-2 rounded-lg border border-[#202432] gap-1.5 w-28 select-none">
      {/* Channel Label */}
      <span
        className="text-[11px] font-bold font-mono tracking-wider px-2 py-0.5 rounded shadow-sm"
        style={{ backgroundColor: color, color: '#000' }}
      >
        CH {id}
      </span>

      {/* Trim / Gain */}
      <div className="py-0.5">
        <RotaryKnob
          label="TRIM"
          value={trim}
          min={0}
          max={2}
          defaultValue={1.0}
          size={36}
          color="#f3f4f6"
          displayValue={`${((trim - 1) * 6).toFixed(1)}dB`}
          onChange={onChangeTrim}
        />
      </div>

      <div className="w-full h-[1px] bg-[#1e222e] my-0.5" />

      {/* High EQ & Kill */}
      <div className="flex items-center gap-1">
        <RotaryKnob
          label="HI"
          value={eq.high}
          min={-26}
          max={6}
          defaultValue={0}
          bipolar={true}
          size={36}
          color="#38bdf8"
          unit="dB"
          onChange={(v) => handleEqChange('high', v)}
        />
        <button
          onClick={() => handleKillToggle('high')}
          className={`w-4 h-4 rounded-[2px] text-[8px] font-bold border transition-all ${
            eq.highKill
              ? 'bg-red-500 text-white border-red-500 shadow-[0_0_6px_#ef4444]'
              : 'bg-[#181a24] text-neutral-500 border-[#2b3040] hover:text-neutral-300'
          }`}
          title="High EQ Kill"
        >
          K
        </button>
      </div>

      {/* Mid EQ & Kill */}
      <div className="flex items-center gap-1">
        <RotaryKnob
          label="MID"
          value={eq.mid}
          min={-26}
          max={6}
          defaultValue={0}
          bipolar={true}
          size={36}
          color="#4ade80"
          unit="dB"
          onChange={(v) => handleEqChange('mid', v)}
        />
        <button
          onClick={() => handleKillToggle('mid')}
          className={`w-4 h-4 rounded-[2px] text-[8px] font-bold border transition-all ${
            eq.midKill
              ? 'bg-red-500 text-white border-red-500 shadow-[0_0_6px_#ef4444]'
              : 'bg-[#181a24] text-neutral-500 border-[#2b3040] hover:text-neutral-300'
          }`}
          title="Mid EQ Kill"
        >
          K
        </button>
      </div>

      {/* Low EQ & Kill */}
      <div className="flex items-center gap-1">
        <RotaryKnob
          label="LOW"
          value={eq.low}
          min={-26}
          max={6}
          defaultValue={0}
          bipolar={true}
          size={36}
          color="#f87171"
          unit="dB"
          onChange={(v) => handleEqChange('low', v)}
        />
        <button
          onClick={() => handleKillToggle('low')}
          className={`w-4 h-4 rounded-[2px] text-[8px] font-bold border transition-all ${
            eq.lowKill
              ? 'bg-red-500 text-white border-red-500 shadow-[0_0_6px_#ef4444]'
              : 'bg-[#181a24] text-neutral-500 border-[#2b3040] hover:text-neutral-300'
          }`}
          title="Low EQ Kill"
        >
          K
        </button>
      </div>

      <div className="w-full h-[1px] bg-[#1e222e] my-0.5" />

      {/* Sound Color Filter (HPF / LPF) */}
      <div className="py-0.5">
        <RotaryKnob
          label="FILTER"
          value={filter}
          min={-1}
          max={1}
          defaultValue={0}
          bipolar={true}
          size={40}
          color="#fbbf24"
          displayValue={
            Math.abs(filter) < 0.05
              ? 'OFF'
              : filter < 0
              ? `LP ${Math.round(-filter * 100)}%`
              : `HP ${Math.round(filter * 100)}%`
          }
          onChange={onChangeFilter}
        />
      </div>

      {/* Headphone Cue (PFL) Button */}
      <button
        onClick={onToggleCue}
        className={`w-14 py-1 rounded border flex items-center justify-center gap-1 text-[9px] font-bold transition-all ${
          cue
            ? 'bg-[#ea580c] text-white border-[#ea580c] shadow-[0_0_8px_#ea580c]'
            : 'bg-[#181a24] text-neutral-400 border-[#2b3040] hover:text-white'
        }`}
        title={`Headphone Cue PFL for Channel ${id}`}
      >
        <Headphones className="w-3 h-3" />
        <span>CUE</span>
      </button>

      {/* Channel Fader and VU Meter */}
      <div className="flex items-center gap-2 pt-1">
        <VUMeter level={level} height={100} segments={12} stereo={false} />
        <VerticalFader
          value={volume}
          min={0}
          max={1}
          defaultValue={0.8}
          height={100}
          width={28}
          color={color}
          showScale={false}
          onChange={onChangeVolume}
        />
      </div>

      {/* Crossfader Assign Selector */}
      <div className="flex bg-[#141620] rounded p-0.5 border border-[#232734] mt-1">
        {(['A', 'THRU', 'B'] as const).map((assign) => (
          <button
            key={assign}
            onClick={() => onChangeCrossfaderAssign(assign)}
            className={`px-1.5 py-0.5 text-[8px] font-bold font-mono rounded transition-colors ${
              crossfaderAssign === assign
                ? 'bg-neutral-300 text-black'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {assign}
          </button>
        ))}
      </div>
    </div>
  )
}

