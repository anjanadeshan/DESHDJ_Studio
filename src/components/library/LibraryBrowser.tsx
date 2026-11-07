import React, { useState, useRef } from 'react'
import type { DeckId, Track } from '../../types/dj'
import { FileSystemManager } from '../../library/FileSystemManager'
import { formatTime, formatBpm } from '../../utils/formatters'
import { FolderOpen, Upload, Search, Music, Disc3, Trash2 } from 'lucide-react'

interface LibraryBrowserProps {
  tracks: Track[]
  isFourDeckMode: boolean
  onAddTracks: (tracks: Track[]) => void
  onClearLibrary: () => void
  onLoadTrackToDeck: (track: Track, deckId: DeckId) => void
}

export const LibraryBrowser: React.FC<LibraryBrowserProps> = ({
  tracks,
  isFourDeckMode,
  onAddTracks,
  onClearLibrary,
  onLoadTrackToDeck,
}) => {
  const [search, setSearch] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [scanStatus, setScanStatus] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleOpenFolder = async () => {
    try {
      setIsScanning(true)
      setScanStatus('Scanning folder...')
      const result = await FileSystemManager.selectDirectory((scanned, total) => {
        setScanStatus(`Reading metadata (${scanned}/${total})...`)
      })
      onAddTracks(result.tracks)
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        alert((err as Error).message || 'Failed to open local directory.')
      }
    } finally {
      setIsScanning(false)
      setScanStatus('')
    }
  }

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    setIsScanning(true)
    setScanStatus('Importing audio files...')
    try {
      const newTracks = await FileSystemManager.processFiles(e.target.files, (scanned, total) => {
        setScanStatus(`Processing ${scanned}/${total}...`)
      })
      onAddTracks(newTracks)
    } catch (err) {
      console.error(err)
    } finally {
      setIsScanning(false)
      setScanStatus('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Filtered tracks
  const filteredTracks = tracks.filter((t) => {
    const q = search.toLowerCase()
    return (
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex flex-col bg-[#0e1017] rounded-lg border border-[#202432] shadow-xl w-full select-none overflow-hidden">
      {/* Library Toolbar */}
      <div className="flex items-center justify-between p-2.5 bg-[#12141c] border-b border-[#202432] gap-3">
        {/* Left Actions: Folder & File Picker */}
        <div className="flex items-center gap-2">
          {FileSystemManager.isSupported() && (
            <button
              onClick={handleOpenFolder}
              disabled={isScanning}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00e5ff] text-black font-bold text-xs rounded hover:bg-[#33ebff] transition-all disabled:opacity-50 shadow-sm"
              title="Select local music folder on your PC"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Open Music Folder</span>
            </button>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isScanning}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1d27] text-neutral-200 font-bold text-xs rounded border border-[#2d3345] hover:bg-[#232838] transition-all disabled:opacity-50"
            title="Import audio files from computer"
          >
            <Upload className="w-4 h-4 text-neutral-400" />
            <span>Add Audio Files</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="audio/*"
            className="hidden"
            onChange={handleFileInputChange}
          />

          {isScanning && (
            <span className="text-xs font-mono text-[#00e5ff] animate-pulse">
              {scanStatus}
            </span>
          )}
        </div>

        {/* Right Search & Track Count */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search library..."
              className="bg-[#090a0f] text-neutral-200 text-xs pl-7 pr-3 py-1 rounded border border-[#232734] focus:outline-none focus:border-[#00e5ff] w-48"
            />
          </div>

          <span className="text-xs font-mono text-neutral-400 px-2 py-1 bg-[#181a25] rounded border border-[#252938]">
            {filteredTracks.length} tracks
          </span>

          {tracks.length > 0 && (
            <button
              onClick={onClearLibrary}
              className="p-1 text-neutral-500 hover:text-red-400 rounded transition-colors"
              title="Clear Library"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Track Table */}
      <div className="max-h-56 overflow-y-auto">
        {filteredTracks.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-neutral-500 gap-2">
            <Music className="w-10 h-10 opacity-30 text-[#00e5ff]" />
            <span className="text-sm font-medium">No tracks found</span>
            <span className="text-xs text-neutral-600">
              Click &quot;Open Music Folder&quot; or drag audio files anywhere into the browser
            </span>
          </div>
        ) : (
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="bg-[#0a0b10] text-[10px] text-neutral-500 uppercase font-mono sticky top-0 border-b border-[#1b1e2a] z-10">
              <tr>
                <th className="py-1.5 px-3 w-8">#</th>
                <th className="py-1.5 px-3">Title</th>
                <th className="py-1.5 px-3">Artist</th>
                <th className="py-1.5 px-3 text-right">BPM</th>
                <th className="py-1.5 px-3 text-right">Time</th>
                <th className="py-1.5 px-3 text-center">Load Deck</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#171924]">
              {filteredTracks.map((track, idx) => (
                <tr
                  key={track.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', track.id)
                  }}
                  className="hover:bg-[#161824] transition-colors group cursor-grab"
                >
                  <td className="py-2 px-3 font-mono text-neutral-600">{idx + 1}</td>

                  {/* Title & Artwork */}
                  <td className="py-2 px-3 font-semibold text-white flex items-center gap-2">
                    {track.coverArtUrl ? (
                      <img
                        src={track.coverArtUrl}
                        alt="art"
                        className="w-6 h-6 rounded object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded bg-[#1e2230] flex items-center justify-center shrink-0">
                        <Disc3 className="w-3.5 h-3.5 text-neutral-500" />
                      </div>
                    )}
                    <span className="truncate max-w-xs">{track.title}</span>
                  </td>

                  <td className="py-2 px-3 text-neutral-400 truncate max-w-xs">
                    {track.artist}
                  </td>

                  <td className="py-2 px-3 text-right font-mono text-neutral-300">
                    {formatBpm(track.bpm)}
                  </td>

                  <td className="py-2 px-3 text-right font-mono text-neutral-400">
                    {formatTime(track.duration)}
                  </td>

                  {/* Load Buttons */}
                  <td className="py-2 px-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => onLoadTrackToDeck(track, 'A')}
                        className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-[#00e5ff]/20 text-[#00e5ff] hover:bg-[#00e5ff] hover:text-black border border-[#00e5ff]/40 transition-all"
                        title="Load into Deck A"
                      >
                        DECK A
                      </button>

                      <button
                        onClick={() => onLoadTrackToDeck(track, 'B')}
                        className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-[#ff3366]/20 text-[#ff3366] hover:bg-[#ff3366] hover:text-white border border-[#ff3366]/40 transition-all"
                        title="Load into Deck B"
                      >
                        DECK B
                      </button>

                      {isFourDeckMode && (
                        <>
                          <button
                            onClick={() => onLoadTrackToDeck(track, 'C')}
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-[#ffaa00]/20 text-[#ffaa00] hover:bg-[#ffaa00] hover:text-black border border-[#ffaa00]/40 transition-all"
                            title="Load into Deck C"
                          >
                            C
                          </button>
                          <button
                            onClick={() => onLoadTrackToDeck(track, 'D')}
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-[#a855f7]/20 text-[#a855f7] hover:bg-[#a855f7] hover:text-white border border-[#a855f7]/40 transition-all"
                            title="Load into Deck D"
                          >
                            D
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

