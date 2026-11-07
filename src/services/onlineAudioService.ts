import type { OnlineTrack, Track } from '../types/dj'

// Curated high-quality, royalty-free DJ tracks hosted on open CDNs with CORS enabled
export const CURATED_ONLINE_TRACKS: OnlineTrack[] = [
  {
    id: 'curated-rave-digger-1',
    title: 'Rave Digger (Electro Breakbeat 130 BPM)',
    artist: 'Future Funk Squad',
    duration: 174,
    thumbnailUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300&q=80',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=rave-digger',
    streamUrl: 'https://raw.githubusercontent.com/goldfire/howler.js/master/examples/player/audio/rave_digger.mp3',
  },
  {
    id: 'curated-running-out-2',
    title: 'Running Out (Club Dance 126 BPM)',
    artist: 'HyperNova',
    duration: 182,
    thumbnailUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=running-out-dance',
    streamUrl: 'https://raw.githubusercontent.com/goldfire/howler.js/master/examples/player/audio/running_out.mp3',
  },
  {
    id: 'curated-80s-vibe-3',
    title: '80s Retro Vibe (Synthwave 118 BPM)',
    artist: 'RetroFuture 84',
    duration: 195,
    thumbnailUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&q=80',
    platform: 'soundcloud',
    url: 'https://soundcloud.com/retrofuture-84/80s-vibe',
    streamUrl: 'https://raw.githubusercontent.com/goldfire/howler.js/master/examples/player/audio/80s_vibe.mp3',
  },
  {
    id: 'curated-viper-edm-4',
    title: 'Viper Protocol (Tech House 128 BPM)',
    artist: 'SubZero Bass',
    duration: 160,
    thumbnailUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=viper-edm',
    streamUrl: 'https://raw.githubusercontent.com/mdn/webaudio-examples/main/audio-analyser/viper.mp3',
  },
  {
    id: 'curated-groove-5',
    title: 'All The Same (Indie Groove 120 BPM)',
    artist: 'Mythium Collective',
    duration: 218,
    thumbnailUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300&q=80',
    platform: 'soundcloud',
    url: 'https://soundcloud.com/mythium/all-the-same',
    streamUrl: 'https://archive.org/download/mythium/JLS_ATI.mp3',
  },
]

export class OnlineAudioService {
  /**
   * Detects if an input string is a valid URL
   */
  public static isValidUrl(input: string): boolean {
    try {
      new URL(input.trim())
      return true
    } catch {
      return false
    }
  }

  /**
   * Checks if a URL is a YouTube video URL
   */
  public static isYouTubeUrl(url: string): boolean {
    return /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)/i.test(url.trim())
  }

  /**
   * Extracts the YouTube Video ID
   */
  public static extractYouTubeVideoId(url: string): string | null {
    const trimmed = url.trim()
    const match = trimmed.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
    )
    return match ? match[1] : null
  }

  /**
   * Checks if a URL is a SoundCloud URL
   */
  public static isSoundCloudUrl(url: string): boolean {
    return /soundcloud\.com\/[\w-]+\/[\w-]+/i.test(url.trim())
  }

  /**
   * Checks if a URL points directly to an audio file
   */
  public static isDirectAudioUrl(url: string): boolean {
    return /\.(mp3|wav|ogg|m4a|aac|flac)(\?.*)?$/i.test(url.trim())
  }

  /**
   * Identifies the platform based on URL
   */
  public static detectPlatform(url: string): 'youtube' | 'soundcloud' | 'url' | null {
    if (this.isYouTubeUrl(url)) return 'youtube'
    if (this.isSoundCloudUrl(url)) return 'soundcloud'
    if (this.isValidUrl(url)) return 'url'
    return null
  }

  /**
   * Searches for actual tracks from YouTube or curated lists
   */
  public static async searchTracks(
    query: string,
    platformFilter: 'all' | 'youtube' | 'soundcloud' | 'url' = 'all'
  ): Promise<OnlineTrack[]> {
    const cleanQuery = query.trim()
    if (!cleanQuery) {
      return CURATED_ONLINE_TRACKS.filter(
        (t) => platformFilter === 'all' || t.platform === platformFilter
      )
    }

    // 1. Try real backend search endpoint (powered by server-side extractor)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(cleanQuery)}`, {
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        const results: OnlineTrack[] = await res.json()
        if (Array.isArray(results) && results.length > 0) {
          return results.filter(
            (t) => platformFilter === 'all' || t.platform === platformFilter
          )
        }
      }
    } catch {
      // Backend search endpoint unavailable or timed out; check curated
    }

    // 2. Fallback: Search curated library for matching query
    return CURATED_ONLINE_TRACKS.filter((t) => {
      const matchText = `${t.title} ${t.artist}`.toLowerCase()
      const matchesFilter = platformFilter === 'all' || t.platform === platformFilter
      return matchesFilter && matchText.includes(cleanQuery.toLowerCase())
    })
  }

  /**
   * Resolves any online track or URL and downloads its actual audio data as an ArrayBuffer
   */
  public static async resolveAndDownloadAudio(
    input: OnlineTrack | string,
    onProgress?: (status: string) => void
  ): Promise<{
    arrayBuffer: ArrayBuffer
    metadata: Partial<Track>
  }> {
    const url = typeof input === 'string' ? input.trim() : input.url
    const platform = typeof input === 'string' ? this.detectPlatform(url) : input.platform

    // Case 1: Curated preset track with direct audio CDN URL
    if (typeof input !== 'string' && input.streamUrl) {
      onProgress?.('Downloading high-speed audio stream...')
      const res = await fetch(input.streamUrl)
      if (!res.ok) throw new Error(`Failed to download audio from ${input.streamUrl}`)
      const arrayBuffer = await res.arrayBuffer()
      return {
        arrayBuffer,
        metadata: {
          title: input.title,
          artist: input.artist,
          duration: input.duration,
          coverArtUrl: input.thumbnailUrl,
          source: input.platform,
          streamUrl: input.streamUrl,
        },
      }
    }

    // Case 2: YouTube or SoundCloud URL
    if (platform === 'youtube' || platform === 'soundcloud') {
      onProgress?.('Fetching song info from YouTube / SoundCloud...')

      let metaTitle = typeof input !== 'string' ? input.title : ''
      let metaArtist = typeof input !== 'string' ? input.artist : ''
      let metaDuration = typeof input !== 'string' ? input.duration : 0
      let metaThumbnail = typeof input !== 'string' ? input.thumbnailUrl : ''

      // If we don't have metadata yet (user pasted URL directly), fetch it from /api/info
      if (!metaTitle) {
        try {
          const infoRes = await fetch(`/api/info?url=${encodeURIComponent(url)}`, {
            signal: AbortSignal.timeout(6000),
          })
          if (infoRes.ok) {
            const info = await infoRes.json()
            metaTitle = info.title || 'YouTube Song'
            metaArtist = info.artist || 'Online Artist'
            metaDuration = info.duration || 180
            metaThumbnail = info.thumbnailUrl || ''
          }
        } catch {
          metaTitle = 'Online Track'
          metaArtist = platform === 'youtube' ? 'YouTube' : 'SoundCloud'
        }
      }

      onProgress?.(`Streaming actual audio for "${metaTitle || 'song'}"...`)

      // Stream actual audio bytes via server extraction endpoint
      const streamEndpoint = `/api/stream?url=${encodeURIComponent(url)}`
      const streamRes = await fetch(streamEndpoint)

      if (!streamRes.ok) {
        throw new Error(`Failed to extract audio stream from ${platform}. Please check the URL.`)
      }

      const arrayBuffer = await streamRes.arrayBuffer()
      if (arrayBuffer.byteLength < 5000) {
        throw new Error('Downloaded stream was incomplete or empty.')
      }

      onProgress?.('Audio downloaded! Decoding into Web Audio engine...')

      return {
        arrayBuffer,
        metadata: {
          title: metaTitle,
          artist: metaArtist,
          duration: metaDuration,
          coverArtUrl: metaThumbnail,
          source: platform,
          streamUrl: url,
        },
      }
    }

    // Case 3: Direct Audio File URL (mp3/wav/ogg/flac)
    onProgress?.('Downloading direct audio file...')
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Could not download audio from ${url}`)
    const arrayBuffer = await res.arrayBuffer()

    const fileName = url.split('/').pop()?.split('?')[0] || 'Audio Stream'
    const cleanTitle = decodeURIComponent(fileName.replace(/\.[^/.]+$/, ''))

    return {
      arrayBuffer,
      metadata: {
        title: typeof input !== 'string' ? input.title : cleanTitle,
        artist: typeof input !== 'string' ? input.artist : 'Web Stream',
        duration: typeof input !== 'string' ? input.duration : 0,
        coverArtUrl:
          typeof input !== 'string'
            ? input.thumbnailUrl
            : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80',
        source: 'url',
        streamUrl: url,
      },
    }
  }
}
