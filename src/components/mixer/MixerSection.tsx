import React from 'react'
import type { DeckId, DeckState, MixerState } from '../../types/dj'
import { MixerChannel } from './MixerChannel'
import { Crossfader } from './Crossfader'
import { RotaryKnob } from '../common/RotaryKnob'
import { VUMeter } from '../common/VUMeter'
import { Volume2, Headphones } from 'lucide-react'

interface MixerSectionProps {
  decks: DeckState[]
  activeLeftDeckId: 'A' | 'C'
  activeRightDeckId: 'B' | 'D'
  mixerState: MixerState
  onChangeEQ: (deckId: DeckId, eq: DeckState['eq']) => void
  onChangeFilter: (deckId: DeckId, val: number) => void
  onChangeTrim: (deckId: DeckId, val: number) => void
  onChangeVolume: (deckId: DeckId, val: number) => void
  onToggleCue: (deckId: DeckId) => void
  onChangeCrossfaderAssign: (deckId: DeckId, assign: 'A' | 'THRU' | 'B') => void
  onChangeCrossfader: (val: number) => void
  onChangeCrossfaderCurve: (curve: MixerState['crossfaderCurve']) => void
  onChangeMasterVolume: (val: number) => void
  onChangeHeadphoneVolume: (val: number) => void
  onChangeHeadphoneMix: (val: number) => void
  onToggleSplitCue: () => void
}

export const MixerSection: React.FC<MixerSectionProps> = ({
  decks,
  activeLeftDeckId,
  activeRightDeckId,
  mixerState,
  onChangeEQ,
  onChangeFilter,
  onChangeTrim,
  onChangeVolume,
  onToggleCue,
  onChangeCrossfaderAssign,
  onChangeCrossfader,
  onChangeCrossfaderCurve,
  onChangeMasterVolume,
  onChangeHeadphoneVolume,
  onChangeHeadphoneMix,
  onToggleSplitCue,
}) => {
  const leftDeck = decks.find((d) => d.id === activeLeftDeckId) || decks[0]
  const rightDeck = decks.find((d) => d.id === activeRightDeckId) || decks[1]

  const leftColor = activeLeftDeckId === 'A' ? '#00e5ff' : '#ffaa00'
  const rightColor = activeRightDeckId === 'B' ? '#ff3366' : '#a855f7'

  return (
    <div className="flex flex-col items-center bg-[#10121a] p-3 rounded-xl border border-[#232738] shadow-2xl gap-3 select-none">
      {/* Channels Row + Center Master Strip */}
      <div className="flex items-start gap-3">
        {/* Left Active Channel (A or C) */}
        <MixerChannel
          id={leftDeck.id}
          eq={leftDeck.eq}
          filter={leftDeck.filter}
          trim={leftDeck.trim}
          volume={leftDeck.volume}
          level={leftDeck.level}
          cue={leftDeck.headphoneCue}
          crossfaderAssign={leftDeck.crossfaderAssign}
          color={leftColor}
          onChangeEQ={(eq) => onChangeEQ(leftDeck.id, eq)}
          onChangeFilter={(val) => onChangeFilter(leftDeck.id, val)}
          onChangeTrim={(val) => onChangeTrim(leftDeck.id, val)}
          onChangeVolume={(val) => onChangeVolume(leftDeck.id, val)}
          onToggleCue={() => onToggleCue(leftDeck.id)}
          onChangeCrossfaderAssign={(a) => onChangeCrossfaderAssign(leftDeck.id, a)}
        />

        {/* Center Master & Headphone Strip */}
        <div className="flex flex-col items-center justify-between bg-[#0b0c12] p-2.5 rounded-xl border border-[#1d2130] gap-2 h-full min-h-[410px] w-24">
          {/* Master Volume */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1 text-[9px] font-bold text-neutral-400">
              <Volume2 className="w-3.5 h-3.5 text-white" />
              <span>MASTER</span>
            </div>
            <RotaryKnob
              label="LEVEL"
              value={mixerState.masterVolume}
              min={0}
              max={1}
              defaultValue={0.85}
              size={42}
              color="#ffffff"
              displayValue={`${Math.round(mixerState.masterVolume * 100)}%`}
              onChange={onChangeMasterVolume}
            />
          </div>

          {/* Master Stereo Peak LED Meter */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[8px] font-mono text-neutral-500 font-bold">L / R</span>
            <VUMeter level={mixerState.masterLevel} height={120} segments={14} stereo={true} />
          </div>

          {/* Headphone Cue Section */}
          <div className="flex flex-col items-center gap-1.5 pt-1.5 border-t border-[#1b1e2c] w-full">
            <div className="flex items-center gap-1 text-[9px] font-bold text-neutral-400">
              <Headphones className="w-3.5 h-3.5 text-orange-400" />
              <span>PHONES</span>
            </div>

            <RotaryKnob
              label="MIX"
              value={mixerState.headphoneMix}
              min={0}
              max={1}
              defaultValue={0.5}
              size={34}
              color="#ea580c"
              displayValue={
                mixerState.headphoneMix < 0.1
                  ? 'CUE'
                  : mixerState.headphoneMix > 0.9
                  ? 'MASTER'
                  : '50/50'
              }
              onChange={onChangeHeadphoneMix}
            />

            <RotaryKnob
              label="VOL"
              value={mixerState.headphoneVolume}
              min={0}
              max={1}
              defaultValue={0.8}
              size={34}
              color="#ea580c"
              displayValue={`${Math.round(mixerState.headphoneVolume * 100)}%`}
              onChange={onChangeHeadphoneVolume}
            />

            <button
              onClick={onToggleSplitCue}
              className={`px-2 py-0.5 text-[8px] font-bold font-mono rounded border transition-colors cursor-pointer ${
                mixerState.splitCue
                  ? 'bg-orange-500 text-white border-orange-400'
                  : 'bg-[#151722] text-neutral-400 border-[#242838]'
              }`}
              title="Split Cue Mode (Left: Cue, Right: Master)"
            >
              SPLIT
            </button>
          </div>
        </div>

        {/* Right Active Channel (B or D) */}
        <MixerChannel
          id={rightDeck.id}
          eq={rightDeck.eq}
          filter={rightDeck.filter}
          trim={rightDeck.trim}
          volume={rightDeck.volume}
          level={rightDeck.level}
          cue={rightDeck.headphoneCue}
          crossfaderAssign={rightDeck.crossfaderAssign}
          color={rightColor}
          onChangeEQ={(eq) => onChangeEQ(rightDeck.id, eq)}
          onChangeFilter={(val) => onChangeFilter(rightDeck.id, val)}
          onChangeTrim={(val) => onChangeTrim(rightDeck.id, val)}
          onChangeVolume={(val) => onChangeVolume(rightDeck.id, val)}
          onToggleCue={() => onToggleCue(rightDeck.id)}
          onChangeCrossfaderAssign={(a) => onChangeCrossfaderAssign(rightDeck.id, a)}
        />
      </div>

      {/* Crossfader */}
      <Crossfader
        value={mixerState.crossfader}
        curve={mixerState.crossfaderCurve}
        onChange={onChangeCrossfader}
        onChangeCurve={onChangeCrossfaderCurve}
      />
    </div>
  )
}
