import React from 'react'
import { X, Keyboard } from 'lucide-react'

interface KeyboardModalProps {
  isOpen: boolean
  onClose: () => void
}

export const KeyboardModal: React.FC<KeyboardModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#12141c] border border-[#2b3040] rounded-xl shadow-2xl max-w-lg w-full p-5 text-neutral-200 select-none">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#222736] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-[#00e5ff]" />
            <h2 className="text-base font-bold text-white">Keyboard Hotkeys Guide</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts Grid */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          {/* Deck A Controls */}
          <div className="flex flex-col gap-2 bg-[#0a0b10] p-3 rounded-lg border border-[#1d212d]">
            <span className="font-bold text-[#00e5ff] uppercase tracking-wider text-[11px]">
              Deck A Controls
            </span>
            <div className="flex justify-between py-0.5 border-b border-[#181a24]">
              <span className="text-neutral-400">Play / Pause</span>
              <kbd className="px-1.5 py-0.5 bg-[#1e2230] text-white rounded font-mono font-bold">W</kbd>
            </div>
            <div className="flex justify-between py-0.5 border-b border-[#181a24]">
              <span className="text-neutral-400">Cue</span>
              <kbd className="px-1.5 py-0.5 bg-[#1e2230] text-white rounded font-mono font-bold">Q</kbd>
            </div>
            <div className="flex justify-between py-0.5 border-b border-[#181a24]">
              <span className="text-neutral-400">Pitch Bend Down / Up</span>
              <div className="flex gap-1">
                <kbd className="px-1.5 py-0.5 bg-[#1e2230] text-white rounded font-mono font-bold">E</kbd>
                <kbd className="px-1.5 py-0.5 bg-[#1e2230] text-white rounded font-mono font-bold">R</kbd>
              </div>
            </div>
            <div className="flex justify-between py-0.5 border-b border-[#181a24]">
              <span className="text-neutral-400">BPM Sync</span>
              <kbd className="px-1.5 py-0.5 bg-[#1e2230] text-white rounded font-mono font-bold">S</kbd>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-neutral-400">Hot Cues 1 - 4</span>
              <div className="flex gap-1">
                <kbd className="px-1 py-0.5 bg-[#1e2230] text-white rounded font-mono font-bold">1</kbd>
                <kbd className="px-1 py-0.5 bg-[#1e2230] text-white rounded font-mono font-bold">2</kbd>
                <kbd className="px-1 py-0.5 bg-[#1e2230] text-white rounded font-mono font-bold">3</kbd>
                <kbd className="px-1 py-0.5 bg-[#1e2230] text-white rounded font-mono font-bold">4</kbd>
              </div>
            </div>
          </div>

          {/* Deck B Controls */}
          <div className="flex flex-col gap-2 bg-[#0a0b10] p-3 rounded-lg border border-[#1d212d]">
            <span className="font-bold text-[#ff3366] uppercase tracking-wider text-[11px]">
              Deck B Controls
            </span>
            <div className="flex justify-between py-0.5 border-b border-[#181a24]">
              <span className="text-neutral-400">Play / Pause</span>
              <kbd className="px-1.5 py-0.5 bg-[#1e2230] text-white rounded font-mono font-bold">I</kbd>
            </div>
            <div className="flex justify-between py-0.5 border-b border-[#181a24]">
              <span className="text-neutral-400">Cue</span>
              <kbd className="px-1.5 py-0.5 bg-[#1e2230] text-white rounded font-mono font-bold">U</kbd>
            </div>
            <div className="flex justify-between py-0.5 border-b border-[#181a24]">
              <span className="text-neutral-400">Pitch Bend Down / Up</span>
              <div className="flex gap-1">
                <kbd className="px-1.5 py-0.5 bg-[#1e2230] text-white rounded font-mono font-bold">O</kbd>
                <kbd className="px-1.5 py-0.5 bg-[#1e2230] text-white rounded font-mono font-bold">P</kbd>
              </div>
            </div>
            <div className="flex justify-between py-0.5 border-b border-[#181a24]">
              <span className="text-neutral-400">BPM Sync</span>
              <kbd className="px-1.5 py-0.5 bg-[#1e2230] text-white rounded font-mono font-bold">K</kbd>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-neutral-400">Hot Cues 1 - 4</span>
              <div className="flex gap-1">
                <kbd className="px-1 py-0.5 bg-[#1e2230] text-white rounded font-mono font-bold">7</kbd>
                <kbd className="px-1 py-0.5 bg-[#1e2230] text-white rounded font-mono font-bold">8</kbd>
                <kbd className="px-1 py-0.5 bg-[#1e2230] text-white rounded font-mono font-bold">9</kbd>
                <kbd className="px-1 py-0.5 bg-[#1e2230] text-white rounded font-mono font-bold">0</kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Mixer & Global Controls */}
        <div className="mt-4 bg-[#0a0b10] p-3 rounded-lg border border-[#1d212d] text-xs flex flex-col gap-2">
          <span className="font-bold text-amber-400 uppercase tracking-wider text-[11px]">
            Mixer & Crossfader
          </span>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-[#181a24] p-2 rounded border border-[#262b3a]">
              <span className="block text-neutral-400 mb-1">Crossfader Left</span>
              <kbd className="px-2 py-0.5 bg-[#252a3a] text-white rounded font-mono font-bold">X</kbd>
            </div>
            <div className="bg-[#181a24] p-2 rounded border border-[#262b3a]">
              <span className="block text-neutral-400 mb-1">Center Crossfader</span>
              <kbd className="px-2 py-0.5 bg-[#252a3a] text-white rounded font-mono font-bold">C</kbd>
            </div>
            <div className="bg-[#181a24] p-2 rounded border border-[#262b3a]">
              <span className="block text-neutral-400 mb-1">Crossfader Right</span>
              <kbd className="px-2 py-0.5 bg-[#252a3a] text-white rounded font-mono font-bold">V</kbd>
            </div>
          </div>
        </div>

        {/* Close Button */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#00e5ff] text-black font-bold text-xs rounded hover:bg-[#33ebff] transition-all"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  )
}

