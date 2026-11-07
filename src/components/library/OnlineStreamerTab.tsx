import React, { useState, useCallback } from 'react'
import type { DeckId, OnlineTrack } from '../../types/dj'
import {
  OnlineAudioService,
  CURATED_ONLINE_TRACKS,
} from '../../services/onlineAudioService'
import { formatTime } from '../../utils/formatters'
import {
  Search,
  Link as LinkIcon,
  Disc3,
  Loader2,
  Sparkles,
  ArrowRight,
  Globe,
  AlertCircle,
} from 'lucide-react'

// Authentic brand vector icons
const YoutubeIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
)

const SoundCloudIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M11.56 8.87V17h8.77c1.78 0 3.23-1.43 3.23-3.2 0-1.74-1.38-3.15-3.1-3.2-.24-2.61-2.43-4.67-5.11-4.67-1.42 0-2.73.58-3.68 1.51-.04.04-.08.08-.11.12zM9.9 10.37c-.12 0-.21.09-.22.21l-.31 6.21c0 .11.09.21.21.21h.7c.12 0 .21-.09.21-.21V10.58c0-.12-.09-.21-.21-.21h-.59zm-1.84 1.15c-.12 0-.21.09-.22.21l-.22 5.06c0 .11.09.21.21.21h.63c.12 0 .21-.09.21-.21v-5.06c0-.12-.09-.21-.21-.21h-.61zm-1.83.69c-.11 0-.21.09-.22.21l-.15 4.37c0 .11.09.21.21.21h.62c.11 0 .21-.09.21-.21v-4.37c0-.12-.09-.21-.21-.21h-.66zm-1.84.77c-.11 0-.21.09-.21.21l-.1 3.6c0 .11.09.21.21.21h.62c.11 0 .21-.09.21-.21v-3.6c0-.12-.09-.21-.21-.21h-.72zm-1.84.97c-.11 0-.21.09-.21.21l-.06 2.63c0 .11.09.21.21.21h.62c.11 0 .21-.09.21-.21v-2.63c0-.12-.09-.21-.21-.21h-.77z" />
  </svg>
)

interface OnlineStreamerTabProps {
  isFourDeckMode: boolean
  targetDeckId?: DeckId
  onLoadOnlineTrackToDeck: (
    input: OnlineTrack | string,
    deckId: DeckId,
    onProgress: (status: string) => void
  ) => Promise<void>
}

export const OnlineStreamerTab: React.FC<OnlineStreamerTabProps> = ({
  isFourDeckMode,
  targetDeckId,
  onLoadOnlineTrackToDeck,
}) => {
  const [query, setQuery] = useState('')
  const [platformFilter, setPlatformFilter] = useState<'all' | 'youtube' | 'soundcloud' | 'url'>('all')
  const [results, setResults] = useState<OnlineTrack[]>(CURATED_ONLINE_TRACKS)
  const [isSearching, setIsSearching] = useState(false)
  const [loadingDeck, setLoadingDeck] = useState<DeckId | null>(null)
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Detect pasted or typed URL
  const detectedPlatform = OnlineAudioService.detectPlatform(query)
  const isDirectUrl = detectedPlatform !== null

  // Handle Search
  const handleSearch = useCallback(
    async (overrideQuery?: string, filter = platformFilter) => {
      const q = overrideQuery !== undefined ? overrideQuery : query
      if (!q.trim()) {
        setResults(
          CURATED_ONLINE_TRACKS.filter(
            (t) => filter === 'all' || t.platform === filter
          )
        )
        return
      }

      if (isDirectUrl) return

      setIsSearching(true)
      setErrorMessage(null)
      try {
        const searchRes = await OnlineAudioService.searchTracks(q, filter)
        setResults(searchRes)
      } catch (err) {
        setErrorMessage((err as Error).message || 'Failed to search online tracks.')
      } finally {
        setIsSearching(false)
      }
    },
    [platformFilter, query, isDirectUrl]
  )

  const handleFilterChange = (filter: 'all' | 'youtube' | 'soundcloud' | 'url') => {
    setPlatformFilter(filter)
    if (!query.trim()) {
      setResults(
        CURATED_ONLINE_TRACKS.filter((t) => filter === 'all' || t.platform === filter)
      )
    } else if (!isDirectUrl) {
      handleSearch(query, filter)
    }
  }

  // Handle loading into a deck
  const handleLoad = async (trackOrUrl: OnlineTrack | string, deckId: DeckId) => {
    setLoadingDeck(deckId)
    setLoadingTrackId(typeof trackOrUrl === 'string' ? trackOrUrl : trackOrUrl.id)
    setErrorMessage(null)

    try {
      await onLoadOnlineTrackToDeck(trackOrUrl, deckId, (status) => {
        setStatusMessage(status)
      })
      setStatusMessage('Loaded successfully!')
    } catch (err) {
      setErrorMessage((err as Error).message || 'Failed to load audio stream into deck.')
    } finally {
      setLoadingDeck(null)
      setLoadingTrackId(null)
      setTimeout(() => setStatusMessage(''), 3000)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#0c0e14] text-neutral-200">
      {/* Search & URL Input Bar */}
      <div className="p-3 sm:p-4 bg-[#11131c] border-b border-[#1f2334] space-y-3 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Platform Filters */}
          <div className="flex items-center bg-[#181b26] p-1 rounded-lg border border-[#2b3044] gap-1 text-xs">
            <button
              onClick={() => handleFilterChange('all')}
              className={`px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 cursor-pointer ${
                platformFilter === 'all'
                  ? 'bg-[#00e5ff] text-black font-bold shadow'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>All</span>
            </button>

            <button
              onClick={() => handleFilterChange('youtube')}
              className={`px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 cursor-pointer ${
                platformFilter === 'youtube'
                  ? 'bg-[#ff0033] text-white font-bold shadow'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <YoutubeIcon className="w-3.5 h-3.5 text-red-500" />
              <span>YouTube</span>
            </button>

            <button
              onClick={() => handleFilterChange('soundcloud')}
              className={`px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 cursor-pointer ${
                platformFilter === 'soundcloud'
                  ? 'bg-[#ff5500] text-white font-bold shadow'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <SoundCloudIcon className="w-3.5 h-3.5 text-orange-400" />
              <span>SoundCloud</span>
            </button>

            <button
              onClick={() => handleFilterChange('url')}
              className={`px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 cursor-pointer ${
                platformFilter === 'url'
                  ? 'bg-blue-600 text-white font-bold shadow'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5 text-blue-400" />
              <span>Direct Link</span>
            </button>
          </div>

          {targetDeckId && (
            <span className="text-xs font-mono px-2.5 py-1 bg-[#1a2233] border border-[#00e5ff]/30 text-[#00e5ff] rounded-md font-semibold ml-auto">
              Target: DECK {targetDeckId}
            </span>
          )}
        </div>

        {/* Input Box */}
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1 flex items-center">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search YouTube / SoundCloud, or paste any URL (youtu.be/..., soundcloud.com/..., .mp3)..."
              className="w-full bg-[#161924] border border-[#262c3e] focus:border-[#00e5ff] rounded-lg pl-9 pr-24 py-2 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none transition-colors"
            />

            {query && (
              <button
                onClick={() => {
                  setQuery('')
                  setResults(CURATED_ONLINE_TRACKS)
                }}
                className="absolute right-2 text-xs text-neutral-400 hover:text-white px-2 py-0.5 rounded cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {!isDirectUrl && (
            <button
              onClick={() => handleSearch()}
              disabled={isSearching}
              className="px-4 py-2 bg-[#00e5ff] hover:bg-[#33ebff] text-black font-bold text-xs sm:text-sm rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shrink-0 shadow"
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>Search</span>
            </button>
          )}
        </div>

        {/* URL Detection Banner */}
        {isDirectUrl && (
          <div className="flex items-center justify-between p-2.5 bg-[#171c2b] border border-[#2b354e] rounded-lg gap-2 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2 text-xs">
              {detectedPlatform === 'youtube' && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-[#ff0033]/20 text-[#ff4d6d] font-bold rounded border border-[#ff0033]/40">
                  <YoutubeIcon className="w-3.5 h-3.5 text-[#ff4d6d]" /> YouTube Link
                </span>
              )}
              {detectedPlatform === 'soundcloud' && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-[#ff5500]/20 text-[#ff884d] font-bold rounded border border-[#ff5500]/40">
                  <SoundCloudIcon className="w-3.5 h-3.5 text-[#ff884d]" /> SoundCloud Link
                </span>
              )}
              {detectedPlatform === 'url' && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-300 font-bold rounded border border-blue-500/40">
                  <LinkIcon className="w-3.5 h-3.5" /> Direct Audio Link
                </span>
              )}
              <span className="truncate max-w-[200px] xs:max-w-xs sm:max-w-md text-neutral-300 font-mono">
                {query}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => handleLoad(query, targetDeckId || 'A')}
                disabled={loadingDeck !== null}
                className="px-2.5 py-1 bg-[#00e5ff] hover:bg-[#33ebff] text-black font-bold text-xs rounded transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <span>Load {targetDeckId ? `Deck ${targetDeckId}` : 'Deck A'}</span>
                <ArrowRight className="w-3 h-3" />
              </button>

              {!targetDeckId && (
                <button
                  onClick={() => handleLoad(query, 'B')}
                  disabled={loadingDeck !== null}
                  className="px-2.5 py-1 bg-[#ff7700] hover:bg-[#ff9933] text-black font-bold text-xs rounded transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span>Load Deck B</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Status Message or Error Alert */}
        {statusMessage && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#00e5ff]/10 border border-[#00e5ff]/30 text-[#00e5ff] rounded-md text-xs font-mono animate-in fade-in">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-900/30 border border-red-700/50 text-red-200 rounded-md text-xs animate-in fade-in">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Main Track List */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-2">
        {!query && (
          <div className="flex items-center gap-2 px-1 py-1 text-xs text-neutral-400 font-semibold tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5 text-[#00e5ff]" />
            <span>Trending DJ Tracks & Demonstration Streams</span>
          </div>
        )}

        {results.length === 0 && !isSearching && (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-500 space-y-2">
            <Search className="w-8 h-8 opacity-40" />
            <p className="text-sm">No streaming tracks found for &quot;{query}&quot;</p>
            <p className="text-xs text-neutral-600">
              Try a different search term or paste a direct YouTube / SoundCloud URL above.
            </p>
          </div>
        )}

        {results.map((track) => {
          const isLoadingThis = loadingTrackId === track.id
          return (
            <div
              key={track.id}
              className="flex items-center justify-between p-2 sm:p-2.5 bg-[#12151e] hover:bg-[#181c28] border border-[#212638] hover:border-[#303850] rounded-xl transition-all group gap-2 sm:gap-3"
            >
              {/* Thumbnail & Platform Badge */}
              <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-[#0a0c10] border border-[#202534] shrink-0">
                <img
                  src={track.thumbnailUrl}
                  alt={track.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    // Fallback to placeholder
                    ;(e.target as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80'
                  }}
                />
                <span className="absolute bottom-1 right-1 p-0.5 rounded bg-black/80">
                  {track.platform === 'youtube' && <YoutubeIcon className="w-3 h-3 text-red-500" />}
                  {track.platform === 'soundcloud' && <SoundCloudIcon className="w-3 h-3 text-orange-400" />}
                  {track.platform === 'url' && <LinkIcon className="w-3 h-3 text-blue-400" />}
                </span>
              </div>

              {/* Title, Artist, Duration */}
              <div className="flex flex-col flex-1 min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-[#00e5ff] transition-colors">
                  {track.title}
                </h4>
                <div className="flex items-center gap-2 text-[10px] sm:text-xs text-neutral-400 truncate mt-0.5">
                  <span className="truncate">{track.artist}</span>
                  <span className="text-neutral-600">•</span>
                  <span className="font-mono">{formatTime(track.duration)}</span>
                  <span className="text-neutral-600">•</span>
                  <span className="uppercase text-[9px] px-1 py-0.2 bg-[#1c202e] rounded text-neutral-400 border border-[#2b3044]">
                    {track.platform}
                  </span>
                </div>
              </div>

              {/* Deck Action Buttons */}
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                {isLoadingThis ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1b2233] text-[#00e5ff] text-xs font-mono rounded-lg border border-[#00e5ff]/30 animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="hidden xs:inline">Deck {loadingDeck}...</span>
                  </div>
                ) : (
                  <>
                    {/* If modal opened for a specific deck */}
                    {targetDeckId ? (
                      <button
                        onClick={() => handleLoad(track, targetDeckId)}
                        disabled={loadingDeck !== null}
                        className="px-3 py-1.5 bg-[#00e5ff] hover:bg-[#33ebff] text-black font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow"
                      >
                        <Disc3 className="w-3.5 h-3.5" />
                        <span>Load to Deck {targetDeckId}</span>
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleLoad(track, 'A')}
                          disabled={loadingDeck !== null}
                          className="px-2.5 py-1.5 bg-[#00e5ff]/20 hover:bg-[#00e5ff] text-[#00e5ff] hover:text-black font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer border border-[#00e5ff]/40 disabled:opacity-50"
                          title="Load track into Deck A"
                        >
                          <Disc3 className="w-3.5 h-3.5" />
                          <span>Deck A</span>
                        </button>

                        <button
                          onClick={() => handleLoad(track, 'B')}
                          disabled={loadingDeck !== null}
                          className="px-2.5 py-1.5 bg-[#ff7700]/20 hover:bg-[#ff7700] text-[#ff7700] hover:text-black font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer border border-[#ff7700]/40 disabled:opacity-50"
                          title="Load track into Deck B"
                        >
                          <Disc3 className="w-3.5 h-3.5" />
                          <span>Deck B</span>
                        </button>

                        {isFourDeckMode && (
                          <>
                            <button
                              onClick={() => handleLoad(track, 'C')}
                              disabled={loadingDeck !== null}
                              className="px-2 py-1.5 bg-[#00e5ff]/10 hover:bg-[#00e5ff] text-[#00e5ff] hover:text-black font-bold text-xs rounded-lg transition-all cursor-pointer border border-[#00e5ff]/30 disabled:opacity-50"
                              title="Load track into Deck C"
                            >
                              <span>C</span>
                            </button>

                            <button
                              onClick={() => handleLoad(track, 'D')}
                              disabled={loadingDeck !== null}
                              className="px-2 py-1.5 bg-[#ff7700]/10 hover:bg-[#ff7700] text-[#ff7700] hover:text-black font-bold text-xs rounded-lg transition-all cursor-pointer border border-[#ff7700]/30 disabled:opacity-50"
                              title="Load track into Deck D"
                            >
                              <span>D</span>
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
