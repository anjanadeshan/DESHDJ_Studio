import React, { useState, useRef } from 'react'
import type { DeckId, Track, OnlineTrack } from '../../types/dj'
import { FileSystemManager } from '../../library/FileSystemManager'
import { formatTime, formatBpm } from '../../utils/formatters'
import { FolderOpen, Upload, Search, Music, Disc3, Trash2, X, Globe } from 'lucide-react'
import { OnlineStreamerTab } from './OnlineStreamerTab'

interface LibraryModalProps {
  isOpen: boolean
  tracks: Track[]
  isFourDeckMode: boolean
  targetDeckId?: DeckId // If opened directly from Deck A or Deck B source button
  lastSelectedTrackId?: string | null
  onClose: () => void
  onAddTracks: (tracks: Track[]) => void
  onClearLibrary: () => void
  onLoadTrackToDeck: (track: Track, deckId: DeckId) => void
  onLoadOnlineTrackToDeck?: (
    input: OnlineTrack | string,
    deckId: DeckId,
    onProgress: (status: string) => void
  ) => Promise<void>
}

export const LibraryModal: React.FC<LibraryModalProps> = ({
  isOpen,
  tracks,
  isFourDeckMode,
  targetDeckId,
  lastSelectedTrackId,
  onClose,
  onAddTracks,
  onClearLibrary,
  onLoadTrackToDeck,
  onLoadOnlineTrackToDeck,
}) => {
  const [activeTab, setActiveTab] = useState<'local' | 'online'>('local')
  const [search, setSearch] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [scanStatus, setScanStatus] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

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

  const filteredTracks = tracks.filter((t) => {
    const q = search.toLowerCase()
    return (
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q)
    )
  })

  // Prioritize last loaded/selected track at the top
  const sortedTracks = [...filteredTracks].sort((a, b) => {
    if (lastSelectedTrackId) {
      if (a.id === lastSelectedTrackId) return -1
      if (b.id === lastSelectedTrackId) return 1
    }
    const timeA = a.lastLoadedAt || 0
    const timeB = b.lastLoadedAt || 0
    if (timeA !== timeB) return timeB - timeA
    return 0
  })

  return (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-5">
          <div className="bg-[#10121a] border border-[#272c3d] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden text-neutral-200 select-none animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-3.5 bg-[#141622] border-b border-[#212638] shrink-0 gap-2 flex-wrap">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <Music className="w-5 h-5 text-[#00e5ff]" />
                <h2 className="text-sm sm:text-base font-bold text-white tracking-wide truncate">
                  {targetDeckId ? `LOAD TRACK INTO DECK ${targetDeckId}` : 'TRACK LIBRARY'}
                </h2>
              </div>

              {/* Tab Selector: Local Crates vs Online Streamer */}
              <div className="flex items-center bg-[#171a26] p-0.5 rounded-lg border border-[#272d40]">
                <button
                  onClick={() => setActiveTab('local')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'local'
                      ? 'bg-[#00e5ff] text-black shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Local Crates</span>
                  <span className="text-[10px] opacity-75 font-mono ml-0.5">({tracks.length})</span>
                </button>
                {onLoadOnlineTrackToDeck && (
                  <button
                    onClick={() => setActiveTab('online')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'online'
                        ? 'bg-gradient-to-r from-[#ff0033] to-[#ff5500] text-white shadow'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Online Streamer</span>
                    <span className="text-[9px] uppercase px-1 py-0.2 bg-black/40 rounded ml-0.5">YT / SC</span>
                  </button>
                )}
              </div>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#202536] transition-colors cursor-pointer"
                title="Close Library (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeTab === 'online' && onLoadOnlineTrackToDeck ? (
              <OnlineStreamerTab
                isFourDeckMode={isFourDeckMode}
                targetDeckId={targetDeckId}
                onLoadOnlineTrackToDeck={onLoadOnlineTrackToDeck}
              />
            ) : (
              <>
                {/* Toolbar: Open Folder, Add Files, Search */}
                      <div className="flex items-center justify-between p-2 sm:p-3 bg-[#0d0f16] border-b border-[#1f2334] gap-2 shrink-0 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          {FileSystemManager.isSupported() && (
                            <button
                              onClick={handleOpenFolder}
                              disabled={isScanning}
                              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-[#00e5ff] text-black font-bold text-xs rounded-lg hover:bg-[#33ebff] transition-all disabled:opacity-50 shadow-sm cursor-pointer"
                              title="Select a local music folder from your PC"
                            >
                              <FolderOpen className="w-4 h-4" />
                              <span>Open Folder</span>
                            </button>
                          )}

                          <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isScanning}
                            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-[#1a1d29] text-neutral-200 font-bold text-xs rounded-lg border border-[#2f3547] hover:bg-[#252a3b] transition-all disabled:opacity-50 cursor-pointer"
                            title="Import audio files from computer"
                          >
                            <Upload className="w-4 h-4 text-neutral-400" />
                            <span>Add Audio</span>
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
                            <span className="text-xs font-mono text-[#00e5ff] animate-pulse ml-2">
                              {scanStatus}
                            </span>
                          )}
                        </div>

                            <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
                              <div className="relative flex items-center flex-1 sm:flex-initial">
                                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 pointer-events-none" />
                                <input
                                  type="text"
                                  value={search}
                                  onChange={(e) => setSearch(e.target.value)}
                                  placeholder="Search tracks..."
                                  className="bg-[#08090e] text-neutral-200 text-xs pl-8 pr-3 py-1.5 rounded-lg border border-[#25293a] focus:outline-none focus:border-[#00e5ff] w-full sm:w-56"
                                  autoFocus
                                />
                              </div>

                              {tracks.length > 0 && (
                                <button
                                  onClick={onClearLibrary}
                                  className="p-1.5 text-neutral-500 hover:text-red-400 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
                                  title="Clear Library"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Tracks List: Table-fixed with ZERO horizontal scrollbar */}
                            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-[250px] sm:min-h-[300px] max-h-[55vh] w-full">
                              {filteredTracks.length === 0 ? (
                                <div className="py-20 flex flex-col items-center justify-center text-neutral-500 gap-3">
                                  <div className="w-14 h-14 rounded-full bg-[#171a26] flex items-center justify-center">
                                    <Music className="w-7 h-7 opacity-40 text-[#00e5ff]" />
                                  </div>
                                  <span className="text-sm font-semibold text-neutral-300">
                                    No tracks in your library yet
                                  </span>
                                  <p className="text-xs text-neutral-500 max-w-sm text-center">
                                    Click &quot;Open Music Folder&quot; to mount a folder from your PC, or drag and drop audio files directly into the window.
                                  </p>
                                </div>
                              ) : (
                                <table className="w-full table-fixed text-left text-xs text-neutral-300">
                                  <thead className="bg-[#090b10] text-[10px] text-neutral-400 uppercase font-mono sticky top-0 border-b border-[#1d2232] z-10">
                                    <tr>
                                        <th className="py-2 px-2 sm:px-3 w-8 sm:w-10 text-center">#</th>
                                        <th className="py-2 px-2 sm:px-3">Title</th>
                                        <th className="hidden md:table-cell py-2 px-3 w-[26%]">Artist</th>
                                        <th className="py-2 px-2 w-14 sm:w-16 text-right">BPM</th>
                                        <th className="hidden sm:table-cell py-2 px-2 w-16 text-right">Time</th>
                                        <th className="py-2 px-2 sm:px-3 text-center w-28 sm:w-36">
                                          {targetDeckId ? `Deck ${targetDeckId}` : 'Load Deck'}
                                        </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#181b27]">
                                    {sortedTracks.map((track, idx) => {
                                      const isLastLoaded = track.id === lastSelectedTrackId
                                      return (
                                        <tr
                                          key={track.id}
                                          draggable
                                          onDragStart={(e) => {
                                            e.dataTransfer.setData('text/plain', track.id)
                                          }}
                                          className={`hover:bg-[#181a26] transition-colors group cursor-grab ${isLastLoaded ? 'bg-[#00e5ff]/5 border-l-2 border-[#00e5ff]' : ''
                                            }`}
                                        >
                                            <td className="py-2 px-2 sm:px-3 font-mono text-neutral-600 text-center truncate">
                                              {idx + 1}
                                            </td>

                                            {/* Title & Artwork */}
                                                <td className="py-2 px-2 sm:px-3 font-semibold text-white">
                                                  <div className="flex items-center gap-2 overflow-hidden">
                                                    {track.coverArtUrl ? (
                                                      <img
                                                        src={track.coverArtUrl}
                                                        alt="art"
                                                        className="w-7 h-7 rounded object-cover shrink-0 shadow-sm"
                                                      />
                                                    ) : (
                                                      <div className="w-7 h-7 rounded bg-[#1e2232] flex items-center justify-center shrink-0">
                                                        <Disc3 className="w-3.5 h-3.5 text-neutral-500" />
                                                      </div>
                                                    )}
                                                    <span className="truncate" title={track.title}>
                                                      {track.title}
                                                    </span>
                                                    {isLastLoaded && (
                                                        <span className="hidden xs:inline px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/40 shrink-0">
                                                          LAST LOADED
                                                        </span>
                          )}
                                                      </div>
                      </td>

                                                <td className="hidden md:table-cell py-2 px-3 text-neutral-400">
                                                  <div className="truncate" title={track.artist}>
                                                    {track.artist}
                                                  </div>
                                                </td>

                                                <td className="py-2 px-2 text-right font-mono font-bold text-neutral-200">
                                                  {formatBpm(track.bpm)}
                                                </td>

                                                <td className="hidden sm:table-cell py-2 px-2 text-right font-mono text-neutral-400">
                                                  {formatTime(track.duration)}
                                                </td>

                                                  {/* Load Button: Target Deck only if opened from Deck Source; Otherwise all decks */}
                                                  <td className="py-2 px-2 sm:px-3">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                      {targetDeckId ? (
                                                        <button
                                                          onClick={() => {
                                                            onLoadTrackToDeck(track, targetDeckId)
                                                            onClose()
                                                          }}
                                                          className={`px-3 py-1 rounded text-[11px] font-bold font-mono transition-all cursor-pointer shadow-sm active:scale-95 ${targetDeckId === 'A'
                                                              ? 'bg-[#00e5ff] text-black hover:bg-[#33ebff] shadow-[0_0_10px_rgba(0,229,255,0.4)]'
                                                              : targetDeckId === 'B'
                                                                ? 'bg-[#ff3366] text-white hover:bg-[#ff5588] shadow-[0_0_10px_rgba(255,51,102,0.4)]'
                                                                : targetDeckId === 'C'
                                                                  ? 'bg-[#ffaa00] text-black hover:bg-[#ffbb33] shadow-[0_0_10px_rgba(255,170,0,0.4)]'
                                                                  : 'bg-[#a855f7] text-white hover:bg-[#c084fc] shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                                                            }`}
                                                          title={`Load into Deck ${targetDeckId}`}
                                                        >
                                                          LOAD DECK {targetDeckId}
                                                        </button>
                                                      ) : (
                                                        <>
                                                          <button
                                                            onClick={() => {
                                                              onLoadTrackToDeck(track, 'A')
                                                              onClose()
                                                            }}
                                                            className="px-2.5 py-1 rounded text-[10px] font-bold font-mono bg-[#00e5ff]/20 text-[#00e5ff] hover:bg-[#00e5ff] hover:text-black border border-[#00e5ff]/40 transition-all cursor-pointer shadow-sm"
                                                            title="Load into Deck A"
                                                          >
                                                            DECK A
                                                          </button>

                                                          <button
                                                            onClick={() => {
                                                              onLoadTrackToDeck(track, 'B')
                                                              onClose()
                                                            }}
                                                            className="px-2.5 py-1 rounded text-[10px] font-bold font-mono bg-[#ff3366]/20 text-[#ff3366] hover:bg-[#ff3366] hover:text-white border border-[#ff3366]/40 transition-all cursor-pointer shadow-sm"
                                                            title="Load into Deck B"
                                                          >
                                                            DECK B
                                                          </button>

                                                          {isFourDeckMode && (
                                                            <>
                                                              <button
                                                                onClick={() => {
                                                                  onLoadTrackToDeck(track, 'C')
                                                                  onClose()
                                                                }}
                                                                className="px-2 py-1 rounded text-[10px] font-bold font-mono bg-[#ffaa00]/20 text-[#ffaa00] hover:bg-[#ffaa00] hover:text-black border border-[#ffaa00]/40 transition-all cursor-pointer"
                                                                title="Load into Deck C"
                                                              >
                                                                C
                                                              </button>
                                                              <button
                                                                onClick={() => {
                                                                  onLoadTrackToDeck(track, 'D')
                                                                  onClose()
                                                                }}
                                                                className="px-2 py-1 rounded text-[10px] font-bold font-mono bg-[#a855f7]/20 text-[#a855f7] hover:bg-[#a855f7] hover:text-white border border-[#a855f7]/40 transition-all cursor-pointer"
                                                                title="Load into Deck D"
                                                              >
                                                                D
                                                              </button>
                                                            </>
                                                          )}
                                                        </>
                                                      )}
                                                    </div>
                                                  </td>
                                                </tr>
                )})}
                                              </tbody>
                                            </table>
          )}
                                          </div>

                                          {/* Modal Footer */}
                                          <div className="flex items-center justify-between px-5 py-3 bg-[#12141e] border-t border-[#1f2334] text-xs text-neutral-400 shrink-0">
                                            <span>
                                              {targetDeckId
                                                ? `💡 Showing load button for Deck ${targetDeckId}. You can also drag & drop track rows.`
                                                : '💡 Tip: You can also drag track rows directly onto Deck A or Deck B.'}
                                            </span>
                                            <button
                                              onClick={onClose}
                                              className="px-4 py-1.5 bg-[#202536] hover:bg-[#2b3147] text-white font-medium rounded-lg transition-colors cursor-pointer"
                                            >
                                              Close
                                            </button>
                                          </div>
                                        </>
                                      )}
                                    </div>
    </div>
  )
}
