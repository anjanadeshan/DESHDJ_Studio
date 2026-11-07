import React from 'react'
import { Settings, X, Layers, Sliders, Music } from 'lucide-react'
import type { CrossfaderCurve } from '../../types/dj'

interface SettingsModalProps {
  isOpen: boolean
  isFourDeckMode: boolean
  crossfaderCurve: CrossfaderCurve
  onClose: () => void
  onToggleDeckMode: (mode: boolean) => void
  onChangeCrossfaderCurve: (curve: CrossfaderCurve) => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  isFourDeckMode,
  crossfaderCurve,
  onClose,
  onToggleDeckMode,
  onChangeCrossfaderCurve,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#10121a] border border-[#272c3d] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-neutral-200 select-none animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#141622] border-b border-[#212638]">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#00e5ff]" />
            <h2 className="text-base font-bold text-white tracking-wide">
              SYSTEM SETTINGS
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#202536] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="p-5 flex flex-col gap-5 text-xs">
          {/* Deck Configuration */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-neutral-300 font-semibold">
              <Layers className="w-4 h-4 text-[#00e5ff]" />
              <span>Deck Configuration</span>
            </div>
            <p className="text-[11px] text-neutral-500">
              Select whether to use a clean 2-deck setup or enable 4-deck layer switching (Decks C & D).
            </p>

            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                onClick={() => onToggleDeckMode(false)}
                className={`py-2.5 px-3 rounded-lg border font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  !isFourDeckMode
                    ? 'bg-[#00e5ff]/20 text-[#00e5ff] border-[#00e5ff] shadow-[0_0_12px_rgba(0,229,255,0.25)]'
                    : 'bg-[#151722] text-neutral-400 border-[#242938] hover:bg-[#1d2130]'
                }`}
              >
                <span className="text-sm font-black">2 DECKS</span>
                <span className="text-[10px] font-normal opacity-75">
                  Standard Deck A & B
                </span>
              </button>

              <button
                onClick={() => onToggleDeckMode(true)}
                className={`py-2.5 px-3 rounded-lg border font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  isFourDeckMode
                    ? 'bg-[#ffaa00]/20 text-[#ffaa00] border-[#ffaa00] shadow-[0_0_12px_rgba(255,170,0,0.25)]'
                    : 'bg-[#151722] text-neutral-400 border-[#242938] hover:bg-[#1d2130]'
                }`}
              >
                <span className="text-sm font-black">4 DECKS</span>
                <span className="text-[10px] font-normal opacity-75">
                  Enable Layers C & D
                </span>
              </button>
            </div>
          </div>

          <div className="w-full h-[1px] bg-[#1d2130]" />

          {/* Crossfader Curve */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-neutral-300 font-semibold">
              <Sliders className="w-4 h-4 text-purple-400" />
              <span>Default Crossfader Curve</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                onClick={() => onChangeCrossfaderCurve('smooth')}
                className={`py-2 px-3 rounded-lg border font-bold text-center transition-all cursor-pointer ${
                  crossfaderCurve === 'smooth'
                    ? 'bg-neutral-200 text-black border-white shadow-sm'
                    : 'bg-[#151722] text-neutral-400 border-[#242938] hover:bg-[#1d2130]'
                }`}
              >
                SMOOTH MIX
              </button>

              <button
                onClick={() => onChangeCrossfaderCurve('cut')}
                className={`py-2 px-3 rounded-lg border font-bold text-center transition-all cursor-pointer ${
                  crossfaderCurve === 'cut'
                    ? 'bg-[#ff3366] text-white border-[#ff3366] shadow-[0_0_10px_#ff3366]'
                    : 'bg-[#151722] text-neutral-400 border-[#242938] hover:bg-[#1d2130]'
                }`}
              >
                SCRATCH CUT
              </button>
            </div>
          </div>

          <div className="w-full h-[1px] bg-[#1d2130]" />

          {/* Audio Engine Info */}
          <div className="flex items-center justify-between text-[11px] text-neutral-400 bg-[#0c0d14] p-3 rounded-lg border border-[#1b1e2c]">
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-[#22c55e]" />
              <span>Web Audio DSP Sample Rate</span>
            </div>
            <span className="font-mono font-bold text-white">44.1 / 48 kHz</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 bg-[#141622] border-t border-[#212638]">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#00e5ff] hover:bg-[#33ebff] text-black font-extrabold text-xs rounded-lg transition-all cursor-pointer shadow-sm"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  )
}

