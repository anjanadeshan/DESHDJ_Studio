import * as mm from 'music-metadata-browser'
import type { Track } from '../types/dj'

export async function parseTrackMetadata(file: File): Promise<Omit<Track, 'waveform' | 'audioBuffer'>> {
  const id = `${file.name}-${file.size}-${file.lastModified}`
  let title = file.name.replace(/\.[^/.]+$/, '')
  let artist = 'Unknown Artist'
  let album = 'Local Track'
  let duration = 0
  let bpm = 0
  let coverArtUrl: string | undefined = undefined

  // Attempt to parse filename "Artist - Title" format
  if (title.includes(' - ')) {
    const parts = title.split(' - ')
    artist = parts[0].trim()
    title = parts.slice(1).join(' - ').trim()
  }

  try {
    const metadata = await mm.parseBlob(file, { duration: true, skipCovers: false })
    if (metadata.common.title) title = metadata.common.title
    if (metadata.common.artist) artist = metadata.common.artist
    if (metadata.common.album) album = metadata.common.album
    if (metadata.common.bpm) bpm = metadata.common.bpm
    if (metadata.format.duration) duration = metadata.format.duration

    // Extract cover artwork if available
    const picture = mm.selectCover(metadata.common.picture)
    if (picture) {
      const blob = new Blob([new Uint8Array(picture.data)], { type: picture.format })
      coverArtUrl = URL.createObjectURL(blob)
    }
  } catch (err) {
    // Graceful fallback to filename and audio element duration check
    console.warn(`Could not read metadata for ${file.name}, using filename fallback:`, err)
  }

  // If duration wasn't found in metadata, quickly check with Audio element
  if (!duration) {
    try {
      duration = await getAudioDuration(file)
    } catch {
      duration = 0
    }
  }

  return {
    id,
    name: file.name,
    title,
    artist,
    album,
    duration,
    bpm: bpm || 120, // default if unanalyzed
    file,
    coverArtUrl,
  }
}

function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement('audio')
    const url = URL.createObjectURL(file)
    audio.src = url
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(audio.duration || 0)
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(0)
    }
  })
}
