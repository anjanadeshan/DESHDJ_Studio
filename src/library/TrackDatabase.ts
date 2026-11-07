import { get, set, del } from 'idb-keyval'
import type { Track, WaveformData } from '../types/dj'

const DB_KEY_TRACKS = 'webdj_library_tracks'
const DB_KEY_WAVEFORMS_PREFIX = 'webdj_wf_'

export class TrackDatabase {
  public static async loadLibrary(): Promise<Track[]> {
    try {
      const stored = await get<Track[]>(DB_KEY_TRACKS)
      return stored || []
    } catch (e) {
      console.warn('Could not read track library from IndexedDB:', e)
      return []
    }
  }

  public static async saveLibrary(tracks: Track[]): Promise<void> {
    try {
      // Create clone without heavy audioBuffers
      const serializableTracks = tracks.map((t) => ({
        ...t,
        audioBuffer: undefined, // cannot be cloned directly; file is re-decoded on load
      }))
      await set(DB_KEY_TRACKS, serializableTracks)
    } catch (e) {
      console.error('Failed to save library to IndexedDB:', e)
    }
  }

  public static async saveWaveform(trackId: string, waveform: WaveformData): Promise<void> {
    try {
      await set(`${DB_KEY_WAVEFORMS_PREFIX}${trackId}`, {
        peaks: Array.from(waveform.peaks),
        lowPeaks: Array.from(waveform.lowPeaks),
        midPeaks: Array.from(waveform.midPeaks),
        highPeaks: Array.from(waveform.highPeaks),
        length: waveform.length,
      })
    } catch (e) {
      console.warn('Could not cache waveform in IndexedDB:', e)
    }
  }

  public static async loadWaveform(trackId: string): Promise<WaveformData | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cached = await get<any>(`${DB_KEY_WAVEFORMS_PREFIX}${trackId}`)
      if (!cached) return null

      return {
        peaks: new Float32Array(cached.peaks),
        lowPeaks: new Float32Array(cached.lowPeaks),
        midPeaks: new Float32Array(cached.midPeaks),
        highPeaks: new Float32Array(cached.highPeaks),
        length: cached.length,
      }
    } catch {
      return null
    }
  }

  public static async clearLibrary(): Promise<void> {
    await del(DB_KEY_TRACKS)
  }
}

