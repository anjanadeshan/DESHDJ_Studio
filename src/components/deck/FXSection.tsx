import React from 'react'
import type { FXState, FXType } from '../../types/dj'
import { RotaryKnob } from '../common/RotaryKnob'

interface FXSectionProps {
  fx: FXState
  color?: string
  onToggle: () => void
  onChangeType: (type: FXType) => void
  onChangeDryWet: (val: number) => void
  onChangeParam: (val: number) => void
}

const FX_OPTIONS: { id: FXType; label: string; paramLabel: string }[] = [
  { id: 'echo', label: 'ECHO', paramLabel: 'TIME' },
  { id: 'reverb', label: 'REVERB', paramLabel: 'DECAY' },
  { id: 'flanger', label: 'FLANGER', paramLabel: 'RATE' },
  { id: 'bitcrusher', label: 'CRUSH', paramLabel: 'BITS' },
]

export const FXSection: React.FC<FXSectionProps> = ({
  fx,
  color = '#00e5ff',
  onToggle,
  onChangeType,
  onChangeDryWet,
  onChangeParam,
}) => {
  const currentFxOption = FX_OPTIONS.find((f) => f.id === fx.type) || FX_OPTIONS[0]

  return (
    <div className="flex items-center justify-between bg-[#11131a] p-2 rounded-md border border-[#202431] gap-2 select-none">
      {/* Left: FX Type Selector & Power Button */}
      <div className="flex flex-col gap-1">
        <button
          onClick={onToggle}
          className={`px-3 py-1 text-[10px] font-bold rounded border transition-all ${
            fx.enabled
              ? 'bg-[#00e5ff] text-black border-[#00e5ff] shadow-[0_0_10px_#00e5ff]'
              : 'bg-[#181a24] text-neutral-400 border-[#2b3040] hover:text-white'
          }`}
        >
          FX {fx.enabled ? 'ON' : 'OFF'}
        </button>

        <select
          value={fx.type}
          onChange={(e) => onChangeType(e.target.value as FXType)}
          className="bg-[#181b24] text-neutral-300 text-[10px] font-bold font-mono px-1.5 py-1 rounded border border-[#2c3243] cursor-pointer focus:outline-none"
        >
          {FX_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Right: Dry/Wet & Parameter Knobs */}
      <div className="flex items-center gap-3">
        <RotaryKnob
          label={currentFxOption.paramLabel}
          value={fx.param}
          min={0}
          max={1}
          defaultValue={0.5}
          size={38}
          color={color}
          displayValue={`${Math.round(fx.param * 100)}%`}
          onChange={onChangeParam}
        />

        <RotaryKnob
          label="D / W"
          value={fx.dryWet}
          min={0}
          max={1}
          defaultValue={0.5}
          size={38}
          color={color}
          displayValue={`${Math.round(fx.dryWet * 100)}%`}
          onChange={onChangeDryWet}
        />
      </div>
    </div>
  )
}

