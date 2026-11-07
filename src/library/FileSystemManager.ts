import { parseTrackMetadata } from './MetadataReader'
import type { Track } from '../types/dj'

const AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.wav',
  '.flac',
  '.ogg',
  '.m4a',
  '.aac',
  '.aiff',
  '.wma',
])

function isAudioFile(fileName: string): boolean {
  const dotIdx = fileName.lastIndexOf('.')
  if (dotIdx === -1) return false
  const ext = fileName.substring(dotIdx).toLowerCase()
  return AUDIO_EXTENSIONS.has(ext)
}

export class FileSystemManager {
  public static isSupported(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window
  }

  /**
   * Prompts user to select a local folder and scans recursively for audio files
   */
  public static async selectDirectory(
    onProgress?: (scanned: number, total: number) => void
  ): Promise<{ tracks: Track[]; dirHandle?: FileSystemDirectoryHandle }> {
    if (!this.isSupported()) {
      throw new Error('File System Access API is not supported in this browser. Please use Drag & Drop or the File Picker.')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dirHandle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({
      mode: 'read',
    })

    const files: File[] = []
    await this.scanDirectory(dirHandle, files)

    const tracks: Track[] = []
    let processed = 0

    for (const file of files) {
      try {
        const metadata = await parseTrackMetadata(file)
        tracks.push({
          ...metadata,
          handle: undefined, // handles can't be cloned to idb without special care, keep file
        })
      } catch (e) {
        console.error('Failed to parse file:', file.name, e)
      }
      processed++
      if (onProgress) {
        onProgress(processed, files.length)
      }
    }

    return { tracks, dirHandle }
  }

  /**
   * Recursive directory scan
   */
  private static async scanDirectory(
    dirHandle: FileSystemDirectoryHandle,
    collectedFiles: File[],
    maxFiles = 300
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const entry of (dirHandle as any).values()) {
      if (collectedFiles.length >= maxFiles) break

      if (entry.kind === 'file' && isAudioFile(entry.name)) {
        try {
          const file = await entry.getFile()
          collectedFiles.push(file)
        } catch (e) {
          console.warn('Could not read file:', entry.name, e)
        }
      } else if (entry.kind === 'directory') {
        // Skip hidden / system folders
        if (!entry.name.startsWith('.')) {
          await this.scanDirectory(entry, collectedFiles, maxFiles)
        }
      }
    }
  }

  /**
   * Process dropped or selected files directly
   */
  public static async processFiles(
    fileList: FileList | File[],
    onProgress?: (scanned: number, total: number) => void
  ): Promise<Track[]> {
    const files = Array.from(fileList).filter((f) => isAudioFile(f.name))
    const tracks: Track[] = []
    let processed = 0

    for (const file of files) {
      try {
        const metadata = await parseTrackMetadata(file)
        tracks.push(metadata)
      } catch (e) {
        console.error('Failed to parse file:', file.name, e)
      }
      processed++
      if (onProgress) {
        onProgress(processed, files.length)
      }
    }

    return tracks
  }
}

