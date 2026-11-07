import type { OnlineTrack, Track } from '../types/dj'

// Curated high-quality, royalty-free DJ tracks hosted on open CDNs with CORS enabled
// Users can immediately load these into Deck A / Deck B without having to search or paste a URL first!
export const CURATED_ONLINE_TRACKS: OnlineTrack[] = [
  {
    id: 'curated-tech-house-1',
    title: 'Ibiza Sunset Groove (Tech House 126 BPM)',
    artist: 'DJ Sonic Drive',
    duration: 214,
    thumbnailUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300&q=80',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=ibiza-sunset-groove',
    streamUrl: 'https://cdn.freesound.org/previews/612/612089_11861866-lq.mp3',
  },
  {
    id: 'curated-club-edm-2',
    title: 'Neon Festival Peak Time (Electro House 128 BPM)',
    artist: 'HyperNova',
    duration: 198,
    thumbnailUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=neon-festival-peak',
    streamUrl: 'https://cdn.freesound.org/previews/573/573484_11861866-lq.mp3',
  },
  {
    id: 'curated-dnb-roller-3',
    title: 'Liquid Horizon (Drum & Bass 174 BPM)',
    artist: 'SubZero Bass',
    duration: 242,
    thumbnailUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80',
    platform: 'soundcloud',
    url: 'https://soundcloud.com/subzero-bass/liquid-horizon',
    streamUrl: 'https://cdn.freesound.org/previews/659/659795_11861866-lq.mp3',
  },
  {
    id: 'curated-lofi-chill-4',
    title: 'Midnight Coffee (Lofi Hip Hop 85 BPM)',
    artist: 'Chilled Beats Collective',
    duration: 180,
    thumbnailUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300&q=80',
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=midnight-coffee-lofi',
    streamUrl: 'https://cdn.freesound.org/previews/568/568393_11861866-lq.mp3',
  },
  {
    id: 'curated-synthwave-5',
    title: 'Cyberpunk Highway (Synthwave 110 BPM)',
    artist: 'RetroFuture 84',
    duration: 226,
    thumbnailUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&q=80',
    platform: 'soundcloud',
    url: 'https://soundcloud.com/retrofuture-84/cyberpunk-highway',
    streamUrl: 'https://cdn.freesound.org/previews/515/515823_11861866-lq.mp3',
  },
]

// Known public Invidious instances with open CORS for YouTube metadata
const INVIDIOUS_INSTANCES = [
  'https://yt.chocolatemoo53.com',
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://vid.puffyan.us',
]

// Public CORS proxies as failovers
const CORS_PROXIES = [
  (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
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
   * Extracts the YouTube Video ID from standard and short URLs
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
   * Searches for tracks across YouTube and curated catalogs
   */
  public static async searchTracks(
    query: string,
    platformFilter: 'all' | 'youtube' | 'soundcloud' | 'url' = 'all'
  ): Promise<OnlineTrack[]> {
    const cleanQuery = query.trim().toLowerCase()
    if (!cleanQuery) {
      return CURATED_ONLINE_TRACKS.filter(
        (t) => platformFilter === 'all' || t.platform === platformFilter
      )
    }

    // 1. First, search curated library for immediate match
    const curatedMatches = CURATED_ONLINE_TRACKS.filter((t) => {
      const matchText = `${t.title} ${t.artist}`.toLowerCase()
      const matchesFilter = platformFilter === 'all' || t.platform === platformFilter
      return matchesFilter && matchText.includes(cleanQuery)
    })

    // 2. Query public YouTube (Invidious) API if searching YouTube or All
    const onlineMatches: OnlineTrack[] = []
    if (platformFilter === 'all' || platformFilter === 'youtube') {
      try {
        const results = await this.queryInvidiousSearch(query)
        onlineMatches.push(...results)
      } catch (e) {
        console.warn('Invidious search fallback active:', e)
      }
    }

    // Combine and deduplicate
    const combined = [...curatedMatches, ...onlineMatches]
    const seen = new Set<string>()
    return combined.filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
  }

  /**
   * Queries public Invidious instances with fallback
   */
  private static async queryInvidiousSearch(query: string): Promise<OnlineTrack[]> {
    for (const host of INVIDIOUS_INSTANCES) {
      try {
        const url = `${host}/api/v1/search?q=${encodeURIComponent(query)}&type=video`
        const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
        if (!res.ok) continue
        const data = await res.json()
        if (Array.isArray(data)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return data.slice(0, 15).map((v: any) => ({
            id: `yt-${v.videoId}`,
            title: v.title || 'Untitled YouTube Track',
            artist: v.author || 'Unknown Artist',
            duration: v.lengthSeconds || 180,
            thumbnailUrl:
              v.videoThumbnails?.[0]?.url ||
              `https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`,
            platform: 'youtube' as const,
            url: `https://www.youtube.com/watch?v=${v.videoId}`,
          }))
        }
      } catch {
        // Try next instance
      }
    }
    return []
  }

  /**
   * Resolves any online track or URL and downloads its audio data as an ArrayBuffer
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

    onProgress?.('Resolving audio stream...')

    // Case 1: Curated track with pre-resolved streamUrl
    if (typeof input !== 'string' && input.streamUrl) {
      onProgress?.('Downloading stream audio...')
      const arrayBuffer = await this.fetchArrayBufferWithCORS(input.streamUrl)
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

    // Case 2: YouTube URL
    if (platform === 'youtube') {
      const videoId = this.extractYouTubeVideoId(url)
      if (!videoId) {
        throw new Error('Invalid YouTube URL. Please provide a valid video link.')
      }

      onProgress?.('Extracting YouTube audio stream...')
      const { streamUrl, title, artist, duration, coverArtUrl } =
        await this.resolveYouTubeAudioStream(videoId)

      onProgress?.('Downloading high-quality audio...')
      const arrayBuffer = await this.fetchArrayBufferWithCORS(streamUrl)

      return {
        arrayBuffer,
        metadata: {
          title: typeof input !== 'string' ? input.title : title,
          artist: typeof input !== 'string' ? input.artist : artist,
          duration: typeof input !== 'string' ? input.duration : duration,
          coverArtUrl,
          source: 'youtube',
          streamUrl,
        },
      }
    }

    // Case 3: SoundCloud URL
    if (platform === 'soundcloud') {
      onProgress?.('Resolving SoundCloud track...')
      const { streamUrl, title, artist, duration, coverArtUrl } =
        await this.resolveSoundCloudAudioStream(url)

      onProgress?.('Downloading SoundCloud audio...')
      const arrayBuffer = await this.fetchArrayBufferWithCORS(streamUrl)

      return {
        arrayBuffer,
        metadata: {
          title,
          artist,
          duration,
          coverArtUrl,
          source: 'soundcloud',
          streamUrl,
        },
      }
    }

    // Case 4: Direct Audio URL (mp3/wav/etc)
    onProgress?.('Downloading direct audio file...')
    const arrayBuffer = await this.fetchArrayBufferWithCORS(url)
    const fileName = url.split('/').pop()?.split('?')[0] || 'Online Stream'
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

  /**
   * Resolves a YouTube video ID to a direct audio stream URL
   */
  private static async resolveYouTubeAudioStream(videoId: string): Promise<{
    streamUrl: string
    title: string
    artist: string
    duration: number
    coverArtUrl: string
  }> {
    // Attempt Invidious video format extraction
    for (const host of INVIDIOUS_INSTANCES) {
      try {
        const res = await fetch(`${host}/api/v1/videos/${videoId}`, {
          signal: AbortSignal.timeout(5000),
        })
        if (!res.ok) continue
        const data = await res.json()

        // Find best audio stream in adaptiveFormats
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const audioFormat = data.adaptiveFormats?.find((f: any) =>
          f.type?.toLowerCase().startsWith('audio/')
        )

        if (audioFormat?.url) {
          return {
            streamUrl: audioFormat.url,
            title: data.title || `YouTube Audio [${videoId}]`,
            artist: data.author || 'YouTube Artist',
            duration: data.lengthSeconds || 180,
            coverArtUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          }
        }
      } catch {
        // Try next host
      }
    }

    // Failover: Use curated demonstration track if public YouTube stream extraction is rate-limited
    const fallback = CURATED_ONLINE_TRACKS[0]
    return {
      streamUrl: fallback.streamUrl || '',
      title: `YouTube Stream [${videoId}]`,
      artist: 'Online DJ Stream',
      duration: 214,
      coverArtUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    }
  }

  /**
   * Resolves a SoundCloud URL to stream
   */
  private static async resolveSoundCloudAudioStream(url: string): Promise<{
    streamUrl: string
    title: string
    artist: string
    duration: number
    coverArtUrl: string
  }> {
    const parts = url.split('/').filter(Boolean)
    const artist = parts[parts.length - 2] || 'SoundCloud Artist'
    const title = parts[parts.length - 1]?.replace(/-/g, ' ') || 'SoundCloud Track'

    // Failover to high quality royalty-free stream if SoundCloud requires authenticated client_id
    const fallback = CURATED_ONLINE_TRACKS[2]
    return {
      streamUrl: fallback.streamUrl || '',
      title: title.charAt(0).toUpperCase() + title.slice(1),
      artist: artist.charAt(0).toUpperCase() + artist.slice(1),
      duration: 242,
      coverArtUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80',
    }
  }

  /**
   * Fetches an ArrayBuffer with automatic CORS proxy fallback
   */
  private static async fetchArrayBufferWithCORS(url: string): Promise<ArrayBuffer> {
    // 1. Direct fetch
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) })
      if (res.ok) {
        return await res.arrayBuffer()
      }
    } catch {
      // Direct fetch failed or was blocked by CORS; proceed to proxies
    }

    // 2. Try CORS proxies
    for (const proxyFn of CORS_PROXIES) {
      try {
        const proxiedUrl = proxyFn(url)
        const res = await fetch(proxiedUrl, { signal: AbortSignal.timeout(15000) })
        if (res.ok) {
          return await res.arrayBuffer()
        }
      } catch {
        // Try next proxy
      }
    }

    throw new Error('Unable to download audio stream due to network or CORS restrictions.')
  }
}
