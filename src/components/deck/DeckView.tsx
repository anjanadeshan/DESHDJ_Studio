import React, { useState, useRef } from 'react'
import type { DeckState, FXType } from '../../types/dj'
import { JogWheel } from './JogWheel'
import { PitchSection } from './PitchSection'
import { PerformancePads } from './PerformancePads'
import { FXSection } from './FXSection'
import { TrackOverviewBar } from '../waveform/TrackOverviewBar'
import { formatTime } from '../../utils/formatters'
import { Play, Pause, Repeat, Upload, FolderOpen, Disc } from 'lucide-react'

interface DeckViewProps {
  deck: DeckState
  color?: string
  altDeckId?: 'A' | 'B' | 'C' | 'D'
  onFlipDeck?: () => void
  onToggleVinylMode: () => void
  onOpenLibraryForDeck?: () => void
  onPlayPause: () => void
  onCueDown: () => void
  onCueUp: () => void
  onSeek: (time: number) => void
  onStartScratch: () => void
  onScratch: (deltaSec: number, velocity: number) => void
  onStopScratch: () => void
  onNudge: (deltaRate: number) => void
  onPitchChange: (offset: number) => void
  onPitchRangeCycle: () => void
  onKeyLockToggle: () => void
  onSyncToggle: () => void
  onPitchBend: (direction: -1 | 1 | 0) => void
  onSetHotCue: (index: number) => void
  onClearHotCue: (index: number) => void
  onTriggerLoop: (beats: number) => void
  onToggleLoop: () => void
  onHalveLoop: () => void
  onDoubleLoop: () => void
  onLoopIn: () => void
  onLoopOut: () => void
  onToggleFX: () => void
  onChangeFXType: (type: FXType) => void
  onChangeFXDryWet: (val: number) => void
  onChangeFXParam: (val: number) => void
  onDropFileOrTrack: (fileOrTrackId: File | string) => void
}

export const DeckView: React.FC<DeckViewProps> = ({
  deck,
  color = '#00e5ff',
  altDeckId,
  onFlipDeck,
  onToggleVinylMode,
  onOpenLibraryForDeck,
  onPlayPause,
  onCueDown,
  onCueUp,
  onSeek,
  onStartScratch,
  onScratch,
  onStopScratch,
  onNudge,
  onPitchChange,
  onPitchRangeCycle,
  onKeyLockToggle,
  onSyncToggle,
  onPitchBend,
  onSetHotCue,
  onClearHotCue,
  onTriggerLoop,
  onToggleLoop,
  onHalveLoop,
  onDoubleLoop,
  onLoopIn,
  onLoopOut,
  onToggleFX,
  onChangeFXType,
  onChangeFXDryWet,
  onChangeFXParam,
  onDropFileOrTrack,
}) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const duration = deck.duration || deck.track?.duration || 0
  const remaining = Math.max(0, duration - deck.currentTime)
  const effectiveBpm = (deck.track?.bpm || 120) * deck.playbackRate

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onDropFileOrTrack(e.target.files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onDropFileOrTrack(e.dataTransfer.files[0])
      return
    }

    const trackId = e.dataTransfer.getData('text/plain')
    if (trackId) {
      onDropFileOrTrack(trackId)
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex flex-col bg-[#12141c] p-3 rounded-xl border shadow-2xl gap-2.5 w-full max-w-[620px] select-none transition-all ${isDragOver
          ? 'border-2 border-white shadow-[0_0_25px_rgba(255,255,255,0.4)] scale-[1.01]'
          : 'border-[#232736]'
        }`}
      style={{
        borderTop: `4px solid ${color}`,
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {isDragOver && (
        <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center gap-3 border-2 border-dashed border-white pointer-events-none">
          <Upload className="w-12 h-12 text-white animate-bounce" />
          <span className="text-base font-bold text-white tracking-wide">
            DROP AUDIO FILE TO LOAD DECK {deck.id}
          </span>
        </div>
      )}

      {/* Header & Meta */}
      <div className="flex flex-col gap-1.5 bg-[#0d0f15] p-2.5 rounded-lg border border-[#1b1f2b]">
        <div className="flex items-center justify-between gap-2">
          {/* Deck Badge, Source Button, Vinyl Mode Toggle, & Track Title */}
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className="px-2.5 py-1 text-xs font-black rounded font-mono shadow-sm"
                style={{ backgroundColor: color, color: '#000' }}
              >
                DECK {deck.id}
              </span>

              {/* Direct SOURCE / LOAD Button */}
              <button
                onClick={() => {
                  if (onOpenLibraryForDeck) onOpenLibraryForDeck()
                  else fileInputRef.current?.click()
                }}
                className="flex items-center gap-1 px-2.5 py-1 bg-[#1e2332] hover:bg-[#2a3147] text-white rounded border border-[#37405c] text-[11px] font-mono font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                title={`Load track into Deck ${deck.id}`}
              >
                <FolderOpen className="w-3.5 h-3.5 text-[#00e5ff]" />
                <span>SOURCE</span>
              </button>

              {/* VINYL / CDJ Mode Toggle Button */}
              <button
                onClick={onToggleVinylMode}
                className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-mono font-bold transition-all cursor-pointer active:scale-95 ${deck.vinylMode
                    ? 'bg-[#00e5ff]/20 text-[#00e5ff] border-[#00e5ff] shadow-[0_0_8px_rgba(0,229,255,0.3)]'
                    : 'bg-[#181a24] text-neutral-400 border-[#2a2f40] hover:text-white'
                  }`}
                title={`Toggle Vinyl Mode vs CDJ Mode (Current: ${deck.vinylMode ? 'VINYL' : 'CDJ'})`}
              >
                <Disc className="w-3 h-3" />
                <span>{deck.vinylMode ? 'VINYL' : 'CDJ'}</span>
              </button>

              {/* Deck Layer Flip Button (e.g. A <-> C or B <-> D) */}
              {altDeckId && onFlipDeck && (
                <button
                  onClick={onFlipDeck}
                  className="flex items-center gap-1 px-2 py-1 bg-[#1a1d28] hover:bg-[#252a3b] text-neutral-300 rounded border border-[#2d3345] text-[10px] font-mono font-bold transition-all cursor-pointer active:scale-95"
                  title={`Flip layer to Deck ${altDeckId}`}
                >
                  <Repeat className="w-3 h-3 text-neutral-400" />
                  <span>DECK {altDeckId}</span>
                </button>
              )}
            </div>

            <div className="flex flex-col truncate ml-1">
              <span className="text-sm font-bold text-white truncate">
                {deck.track ? deck.track.title : 'No track loaded'}
              </span>
              <span className="text-xs text-neutral-400 truncate">
                {deck.track ? deck.track.artist : 'Click SOURCE or drag file here'}
              </span>
            </div>
          </div>

          {/* Time Readouts */}
          <div className="flex items-baseline gap-2 font-mono text-right shrink-0">
            <div className="flex flex-col items-end">
              <span className="text-base font-bold text-white tracking-wider">
                {formatTime(deck.currentTime)}
              </span>
              <span className="text-[10px] text-neutral-500">
                -{formatTime(remaining)}
              </span>
            </div>
          </div>
        </div>

        {/* Track Overview Mini-Waveform */}
        <TrackOverviewBar deck={deck} onSeek={onSeek} color={color} />
      </div>

      {/* Center Deck Area: Jog Wheel, Transport Buttons, & Pitch Section */}
      <div className="flex items-center justify-between gap-3">
        {/* Left: Pioneer CDJ Cue & Play Buttons */}
        <div className="flex flex-col gap-3 shrink-0">
          {/* CUE Button with Pioneer Hold-Preview Stutter & Setting Behavior */}
          <button
            onPointerDown={onCueDown}
            onPointerUp={onCueUp}
            className={`w-18 h-18 rounded-full border-2 flex flex-col items-center justify-center font-black text-sm shadow-xl active:scale-95 transition-all cursor-pointer ${!deck.isPlaying && Math.abs(deck.currentTime - deck.cuePosition) < 0.05
                ? 'bg-[#ffaa00] text-black border-[#ffaa00] shadow-[0_0_16px_#ffaa00]'
                : 'bg-[#161822] border-[#ffaa00] text-[#ffaa00] hover:bg-[#202534] shadow-[0_0_12px_rgba(255,170,0,0.35)]'
              }`}
            title="CUE: When paused, tap sets new cue point, hold plays stutter preview. When playing, tap stops & jumps to cue."
          >
            <span>CUE</span>
          </button>

          {/* PLAY / PAUSE Button */}
          <button
            onClick={onPlayPause}
            className={`w-18 h-18 rounded-full border-2 flex flex-col items-center justify-center font-black text-sm shadow-xl active:scale-95 transition-all cursor-pointer ${deck.isPlaying
                ? 'bg-[#22c55e] text-black border-[#22c55e] shadow-[0_0_18px_#22c55e]'
                : 'bg-[#161822] text-[#22c55e] border-[#22c55e] hover:bg-[#202534] shadow-[0_0_10px_rgba(34,197,94,0.35)]'
              }`}
            title="Play / Pause"
          >
            {deck.isPlaying ? (
              <Pause className="w-7 h-7 fill-current" />
            ) : (
              <Play className="w-7 h-7 fill-current ml-0.5" />
            )}
          </button>
        </div>

        {/* Center: Large Vinyl / CDJ Jog Wheel */}
        <div className="flex-1 flex justify-center">
          <JogWheel
            isPlaying={deck.isPlaying}
            playbackRate={deck.playbackRate}
            vinylMode={deck.vinylMode}
            color={color}
            deckId={deck.id}
            onStartScratch={onStartScratch}
            onScratch={onScratch}
            onStopScratch={onStopScratch}
            onNudge={onNudge}
          />
        </div>

        {/* Right: Pitch & Tempo Slider Section */}
        <div className="shrink-0 w-36">
          <PitchSection
            bpm={effectiveBpm}
            originalBpm={deck.track?.bpm || 120}
            pitchOffset={deck.pitchOffset}
            pitchRange={deck.pitchRange}
            keyLock={deck.keyLock}
            isSync={deck.sync}
            color={color}
            onPitchChange={onPitchChange}
            onPitchRangeCycle={onPitchRangeCycle}
            onKeyLockToggle={onKeyLockToggle}
            onSyncToggle={onSyncToggle}
            onPitchBend={onPitchBend}
          />
        </div>
      </div>

      {/* FX Rack & Performance Pads */}
      <div className="flex flex-col gap-2">
        <FXSection
          fx={deck.fx}
          color={color}
          onToggle={onToggleFX}
          onChangeType={onChangeFXType}
          onChangeDryWet={onChangeFXDryWet}
          onChangeParam={onChangeFXParam}
        />

        <PerformancePads
          hotCues={deck.hotCues}
          currentTime={deck.currentTime}
          bpm={effectiveBpm}
          loop={deck.loop}
          onSetHotCue={onSetHotCue}
          onClearHotCue={onClearHotCue}
          onTriggerLoop={onTriggerLoop}
          onToggleLoop={onToggleLoop}
          onHalveLoop={onHalveLoop}
          onDoubleLoop={onDoubleLoop}
          onLoopIn={onLoopIn}
          onLoopOut={onLoopOut}
        />
      </div>
    </div>
  )
}
