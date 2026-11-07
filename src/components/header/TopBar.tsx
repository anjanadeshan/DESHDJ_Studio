import React from 'react'
import { Disc3, Keyboard, Maximize, Music, Settings, Layers } from 'lucide-react'

interface TopBarProps {
  audioReady?: boolean
  isFourDeckMode: boolean
  onOpenLibrary: () => void
  onToggleDeckMode: () => void
  onOpenSettings: () => void
  onToggleKeyboardHelp: () => void
  onToggleFullscreen: () => void
}

export const TopBar: React.FC<TopBarProps> = ({
  isFourDeckMode,
  onOpenLibrary,
  onToggleDeckMode,
  onOpenSettings,
  onToggleKeyboardHelp,
  onToggleFullscreen,
}) => {
  return (
    <header className="flex items-center justify-between px-4 py-2 bg-[#090b10] border-b border-[#1c202c] select-none shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#00e5ff] via-[#a855f7] to-[#ff3366] p-0.5 flex items-center justify-center shadow-[0_0_15px_rgba(0,229,255,0.4)]">
            <div className="w-full h-full bg-[#0d0f15] rounded-[6px] flex items-center justify-center">
              <Disc3 className="w-5 h-5 text-white animate-spin-slow" />
            </div>
          </div>
          <span className="text-lg font-black tracking-wider text-white">
            DESHDJ <span className="text-[#00e5ff] font-light">STUDIO</span>
          </span>
        </div>
      </div>

      {/* Center / Right Controls: Browse Library, 2/4 Deck Quick Toggle, Settings, Shortcuts, Fullscreen */}
      <div className="flex items-center gap-2">
        {/* Open Music Library Popup Button */}
        <button
          onClick={onOpenLibrary}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-[#00e5ff] hover:bg-[#33ebff] text-black font-extrabold text-xs rounded-lg transition-all shadow-[0_0_12px_rgba(0,229,255,0.35)] cursor-pointer active:scale-95"
          title="Open Track Library & Local Music Crates (Hotkey: B or Space)"
        >
          <Music className="w-4 h-4 fill-black" />
          <span>BROWSE LIBRARY</span>
        </button>

        {/* Quick Deck Mode Toggle Pill */}
        <button
          onClick={onToggleDeckMode}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold rounded-lg border transition-all cursor-pointer ${
            isFourDeckMode
              ? 'bg-[#ffaa00]/20 text-[#ffaa00] border-[#ffaa00] shadow-[0_0_8px_rgba(255,170,0,0.3)]'
              : 'bg-[#13151f] text-neutral-300 border-[#262b3c] hover:bg-[#1c202e]'
          }`}
          title="Click to toggle between 2-Deck and 4-Deck modes"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{isFourDeckMode ? '4 DECKS' : '2 DECKS'}</span>
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#13151f] text-neutral-300 rounded-lg border border-[#262b3c] hover:bg-[#1c202e] hover:text-white transition-all cursor-pointer"
          title="System Settings (Deck layout, Crossfader curve, Audio)"
        >
          <Settings className="w-3.5 h-3.5 text-neutral-400" />
          <span>SETTINGS</span>
        </button>

        {/* Keyboard Shortcuts Help */}
        <button
          onClick={onToggleKeyboardHelp}
          className="p-2 text-neutral-400 hover:text-white bg-[#13151f] rounded-lg border border-[#262b3c] hover:bg-[#1c202e] transition-all cursor-pointer"
          title="View Keyboard Hotkeys"
        >
          <Keyboard className="w-4 h-4 text-[#00e5ff]" />
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={onToggleFullscreen}
          className="p-2 text-neutral-400 hover:text-white bg-[#13151f] rounded-lg border border-[#262b3c] hover:bg-[#1c202e] transition-all cursor-pointer"
          title="Toggle Fullscreen Mode"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
