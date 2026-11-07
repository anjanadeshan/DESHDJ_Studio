import { useState, useEffect, useRef, useCallback } from 'react'
import type { DeckId, DeckState, Track, MixerState, FXType, OnlineTrack } from './types/dj'
import { AudioEngine } from './audio/AudioEngine'
import { extractWaveformData } from './audio/WaveformExtractor'
import { detectBpm } from './audio/BpmDetector'
import { TrackDatabase } from './library/TrackDatabase'
import { FileSystemManager } from './library/FileSystemManager'
import { OnlineAudioService } from './services/onlineAudioService'
import { TopBar } from './components/header/TopBar'
import { StackedWaveforms } from './components/waveform/StackedWaveforms'
import { DeckView } from './components/deck/DeckView'
import { MixerSection } from './components/mixer/MixerSection'
import { LibraryModal } from './components/library/LibraryModal'
import { SettingsModal } from './components/common/SettingsModal'
import { KeyboardModal } from './components/common/KeyboardModal'

const initialDeck = (id: DeckId): DeckState => ({
  id,
  track: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  playbackRate: 1.0,
  pitchOffset: 0,
  pitchRange: 10,
  keyLock: false,
  vinylMode: true,
  isScratching: false,
  isNudging: false,
  nudgeAmount: 0,
  cuePosition: 0,
  hotCues: Array(8).fill(null),
  loop: { active: false, start: 0, end: 0, beats: 4 },
  sync: false,
  eq: { high: 0, mid: 0, low: 0, highKill: false, midKill: false, lowKill: false },
  filter: 0,
  trim: 1.0,
  volume: 0.8,
  headphoneCue: false,
  crossfaderAssign: id === 'A' || id === 'C' ? 'A' : 'B',
  fx: { type: 'echo', enabled: false, dryWet: 0.5, param: 0.5 },
  level: { left: 0, right: 0 },
})

export function App() {
  const [audioReady, setAudioReady] = useState(false)
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)
  const [targetDeckForLibrary, setTargetDeckForLibrary] = useState<DeckId | undefined>(undefined)
  const [lastSelectedTrackId, setLastSelectedTrackId] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isKeyboardHelpOpen, setIsKeyboardHelpOpen] = useState(false)

  // 2-Deck vs 4-Deck Mode: Default is 2 DECKS
  const [isFourDeckMode, setIsFourDeckMode] = useState(false)

  // 4-Deck Flip: Left deck flips between A <-> C; Right deck flips between B <-> D
  const [activeLeftDeckId, setActiveLeftDeckId] = useState<'A' | 'C'>('A')
  const [activeRightDeckId, setActiveRightDeckId] = useState<'B' | 'D'>('B')

  // Mobile View Navigation: 'A' | 'mixer' | 'B' | 'both' (only active on < xl screens)
  const [mobileActiveTab, setMobileActiveTab] = useState<'A' | 'mixer' | 'B' | 'both'>('A')

  // URL query parameter support for direct modal viewing and testing (?modal=library, ?mode=4deck, ?modal=settings, ?modal=hotkeys)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('modal') === 'library') setIsLibraryOpen(true)
    if (params.get('modal') === 'settings') setIsSettingsOpen(true)
    if (params.get('modal') === 'hotkeys') setIsKeyboardHelpOpen(true)
    if (params.get('mode') === '4deck') setIsFourDeckMode(true)
  }, [])

  const [decks, setDecks] = useState<DeckState[]>([
    initialDeck('A'),
    initialDeck('B'),
    initialDeck('C'),
    initialDeck('D'),
  ])

  const [mixerState, setMixerState] = useState<MixerState>({
    crossfader: 0,
    crossfaderCurve: 'smooth',
    masterVolume: 0.85,
    masterLevel: { left: 0, right: 0 },
    headphoneVolume: 0.8,
    headphoneMix: 0.5,
    splitCue: false,
  })

  const [tracks, setTracks] = useState<Track[]>([])
  const audioEngineRef = useRef<AudioEngine | null>(null)

  // Initialize AudioEngine on first render or interaction
  const getAudioEngine = useCallback(() => {
    if (!audioEngineRef.current) {
      audioEngineRef.current = AudioEngine.getInstance()
    }
    return audioEngineRef.current
  }, [])

  const ensureAudioResumed = useCallback(async () => {
    const engine = getAudioEngine()
    if (engine.ctx.state === 'suspended') {
      await engine.resume()
    }
    setAudioReady(true)
  }, [getAudioEngine])

  // Load persistent library from IndexedDB on startup (do not open modal by default)
  useEffect(() => {
    TrackDatabase.loadLibrary().then((saved) => {
      if (saved && saved.length > 0) {
        setTracks(saved)
      }
    })
  }, [])

  // Drag and drop audio files onto entire window
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }
    const handleDrop = async (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        ensureAudioResumed()
        const newTracks = await FileSystemManager.processFiles(e.dataTransfer.files)
        if (newTracks.length > 0) {
          setTracks((prev) => {
            const updated = [...prev, ...newTracks]
            TrackDatabase.saveLibrary(updated)
            return updated
          })
          setIsLibraryOpen(true)
        }
      }
    }

    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('drop', handleDrop)
    return () => {
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('drop', handleDrop)
    }
  }, [ensureAudioResumed])

  // 60 FPS Engine Polling & Level metering
  useEffect(() => {
    let animId: number
    const engine = getAudioEngine()

    const loop = () => {
      setDecks((prevDecks) =>
        prevDecks.map((d) => {
          const node = engine.getDeck(d.id)
          if (!node) return d

          const currentTime = node.getCurrentTime()
          const levels = node.getLevels()

          // Check Loop wrap-around
          if (d.loop.active && d.isPlaying && currentTime >= d.loop.end) {
            node.seek(d.loop.start)
          }

          if (
            Math.abs(d.currentTime - currentTime) > 0.03 ||
            Math.abs(d.level.left - levels.left) > 0.04 ||
            d.isPlaying !== node.isPlaying
          ) {
            return {
              ...d,
              currentTime,
              isPlaying: node.isPlaying,
              level: levels,
            }
          }
          return d
        })
      )

      // Master VU meter
      const masterLevels = engine.getMasterLevels()
      setMixerState((prev) => {
        if (Math.abs(prev.masterLevel.left - masterLevels.left) > 0.04) {
          return { ...prev, masterLevel: masterLevels }
        }
        return prev
      })

      animId = requestAnimationFrame(loop)
    }

    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [getAudioEngine])

  // Switch between 2-Deck and 4-Deck modes
  const handleSetDeckMode = (is4Deck: boolean) => {
    setIsFourDeckMode(is4Deck)
    if (!is4Deck) {
      setActiveLeftDeckId('A')
      setActiveRightDeckId('B')
    }
  }

  // Load track into deck (handles local files, pre-buffered audio, and stream URLs)
  const handleLoadTrack = async (track: Track, deckId: DeckId) => {
    await ensureAudioResumed()
    const engine = getAudioEngine()
    const node = engine.getDeck(deckId)
    if (!node) return

    try {
      let audioBuffer = track.audioBuffer
      if (!audioBuffer) {
        if (track.file) {
          audioBuffer = await engine.decodeAudioFile(track.file)
        } else if (track.streamUrl) {
          const res = await fetch(track.streamUrl)
          const ab = await res.arrayBuffer()
          audioBuffer = await engine.decodeArrayBuffer(ab)
        }
      }

      if (!audioBuffer) {
        alert('Could not decode audio for track')
        return
      }

      track.audioBuffer = audioBuffer

      // High-resolution Waveform extraction
      let waveform = await TrackDatabase.loadWaveform(track.id)
      if (!waveform) {
        waveform = await extractWaveformData(audioBuffer)
        TrackDatabase.saveWaveform(track.id, waveform)
      }
      track.waveform = waveform

      // High-precision BPM analysis
      if (!track.bpm || track.bpm === 120) {
        const analysis = detectBpm(audioBuffer)
        track.bpm = analysis.bpm
      }

      node.setBuffer(audioBuffer)

      setLastSelectedTrackId(track.id)
      setTracks((prev) => {
        const updated = prev.map((t) =>
          t.id === track.id ? { ...t, lastLoadedAt: Date.now() } : t
        )
        TrackDatabase.saveLibrary(updated)
        return updated
      })

      setDecks((prev) =>
        prev.map((d) =>
          d.id === deckId
            ? {
              ...d,
              track,
              duration: audioBuffer.duration,
              currentTime: 0,
              isPlaying: false,
              cuePosition: 0,
              hotCues: Array(8).fill(null),
              loop: { active: false, start: 0, end: 0, beats: 4 },
            }
            : d
        )
      )
    } catch (err) {
      console.error('Failed to load track into deck:', err)
      alert(`Could not load track: ${(err as Error).message}`)
    }
  }

  // Handle loading online track (YouTube, SoundCloud, or Direct URL) with live progress
  const handleLoadOnlineTrackToDeck = async (
    input: OnlineTrack | string,
    deckId: DeckId,
    onProgress: (status: string) => void
  ) => {
    await ensureAudioResumed()
    const engine = getAudioEngine()
    const node = engine.getDeck(deckId)
    if (!node) return

    onProgress('Connecting to audio source...')
    const { arrayBuffer, metadata } = await OnlineAudioService.resolveAndDownloadAudio(
      input,
      onProgress
    )

    onProgress('Decoding audio samples...')
    const audioBuffer = await engine.decodeArrayBuffer(arrayBuffer)

    onProgress('Extracting 3-band waveform...')
    const waveform = await extractWaveformData(audioBuffer)

    onProgress('Analyzing beatgrid & BPM...')
    const bpmAnalysis = detectBpm(audioBuffer)

    const trackId = typeof input === 'string' ? `online-${Date.now()}` : input.id

    const newTrack: Track = {
      id: trackId,
      name: metadata.title || 'Online Stream',
      title: metadata.title || 'Online Stream',
      artist: metadata.artist || 'Web Stream',
      album: metadata.source ? `${metadata.source.toUpperCase()} Stream` : 'Online Stream',
      duration: audioBuffer.duration,
      bpm: bpmAnalysis.bpm || 120,
      coverArtUrl: metadata.coverArtUrl,
      source: metadata.source || 'url',
      streamUrl: metadata.streamUrl,
      audioBuffer,
      waveform,
      lastLoadedAt: Date.now(),
    }

    // Online streaming tracks are temporary: NEVER saved to library, database, or disk!
    node.setBuffer(audioBuffer)
    setLastSelectedTrackId(newTrack.id)

    setDecks((prev) =>
      prev.map((d) =>
        d.id === deckId
          ? {
              ...d,
              track: newTrack,
              duration: audioBuffer.duration,
              currentTime: 0,
              isPlaying: false,
              cuePosition: 0,
              hotCues: Array(8).fill(null),
              loop: { active: false, start: 0, end: 0, beats: 4 },
            }
          : d
      )
    )

    onProgress('Loaded into Deck!')
  }

  // Handle drop of file or track ID directly on a specific deck
  const handleDropOnDeck = async (fileOrTrackId: File | string, deckId: DeckId) => {
    await ensureAudioResumed()
    if (typeof fileOrTrackId === 'string') {
      const found = tracks.find((t) => t.id === fileOrTrackId)
      if (found) {
        handleLoadTrack(found, deckId)
      }
    } else {
      const newTracks = await FileSystemManager.processFiles([fileOrTrackId])
      if (newTracks.length > 0) {
        const track = newTracks[0]
        setTracks((prev) => {
          const updated = [...prev, track]
          TrackDatabase.saveLibrary(updated)
          return updated
        })
        handleLoadTrack(track, deckId)
      }
    }
  }

  // Play / Pause
  const handlePlayPause = (id: DeckId) => {
    ensureAudioResumed()
    const node = getAudioEngine().getDeck(id)
    if (!node) return

    setDecks((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d
        if (d.isPlaying) {
          node.pause()
          return { ...d, isPlaying: false }
        } else {
          // If starting playback and this deck has SYNC enabled:
          // Quantize the start time to match the exact beat phase of the other deck if playing!
          if (d.sync && d.track) {
            const otherDeckId = id === activeLeftDeckId ? activeRightDeckId : activeLeftDeckId
            const otherDeck = prev.find((p) => p.id === otherDeckId)
            const otherNode = getAudioEngine().getDeck(otherDeckId)
            if (otherDeck?.isPlaying && otherDeck.track && otherNode) {
              const targetBpm = (otherDeck.track.bpm || 120) * otherDeck.playbackRate
              const beatInterval = 60 / targetBpm
              const targetTime = otherNode.getCurrentTime()
              const targetPhase = ((targetTime % beatInterval) + beatInterval) % beatInterval
              const currentPos = node.getCurrentTime()
              const currPhase = ((currentPos % beatInterval) + beatInterval) % beatInterval

              let phaseDelta = targetPhase - currPhase
              if (phaseDelta > beatInterval / 2) phaseDelta -= beatInterval
              if (phaseDelta < -beatInterval / 2) phaseDelta += beatInterval

              const alignedStart = Math.max(0, currentPos + phaseDelta)
              node.seek(alignedStart)
              node.play(alignedStart)
              return { ...d, isPlaying: true, currentTime: alignedStart }
            }
          }

          node.play()
          return { ...d, isPlaying: true }
        }
      })
    )
  }

  // Pioneer CDJ Cue Down
  const handleCueDown = (id: DeckId) => {
    ensureAudioResumed()
    const node = getAudioEngine().getDeck(id)
    if (!node) return

    setDecks((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d

        if (d.isPlaying) {
          // Playing: pause and jump back to cue position
          node.pause()
          node.seek(d.cuePosition)
          return { ...d, isPlaying: false, currentTime: d.cuePosition }
        } else {
          // Paused:
          // If playhead was moved away from cue position by jog wheel / seeking,
          // pressing CUE sets this new spot as the cue point!
          if (Math.abs(d.currentTime - d.cuePosition) > 0.05) {
            return { ...d, cuePosition: d.currentTime }
          } else {
            // Already at cue position: hold to preview stutter!
            node.startCuePreview(d.cuePosition)
            return { ...d, isPlaying: true, currentTime: d.cuePosition }
          }
        }
      })
    )
  }

  // Pioneer CDJ Cue Up
  const handleCueUp = (id: DeckId) => {
    const node = getAudioEngine().getDeck(id)
    if (!node) return

    setDecks((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d
        if (node.isCuePreviewing) {
          node.stopCuePreview(d.cuePosition)
          return { ...d, isPlaying: false, currentTime: d.cuePosition }
        }
        return d
      })
    )
  }

  const handleSeek = (id: DeckId, time: number) => {
    ensureAudioResumed()
    const node = getAudioEngine().getDeck(id)
    if (node) {
      node.seek(time)
      setDecks((prev) =>
        prev.map((d) => (d.id === id ? { ...d, currentTime: time } : d))
      )
    }
  }

  const handleToggleVinylMode = (id: DeckId) => {
    setDecks((prev) =>
      prev.map((d) => (d.id === id ? { ...d, vinylMode: !d.vinylMode } : d))
    )
  }

  const handleStartScratch = (id: DeckId) => {
    ensureAudioResumed()
    const node = getAudioEngine().getDeck(id)
    if (node) {
      node.startScratch()
    }
  }

  const handleScratch = (id: DeckId, deltaSec: number, velocity: number) => {
    ensureAudioResumed()
    const node = getAudioEngine().getDeck(id)
    if (node) {
      node.scratch(deltaSec, velocity)
      // Update deck's current time state so cue points can be set precisely
      setDecks((prev) =>
        prev.map((d) =>
          d.id === id ? { ...d, currentTime: node.getCurrentTime() } : d
        )
      )
    }
  }

  const handleStopScratch = (id: DeckId) => {
    const node = getAudioEngine().getDeck(id)
    if (node) {
      node.stopScratch()
      setDecks((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
              ...d,
              isPlaying: node.isPlaying,
              currentTime: node.getCurrentTime(),
            }
            : d
        )
      )
    }
  }

  const handleNudge = (id: DeckId, deltaRate: number) => {
    const node = getAudioEngine().getDeck(id)
    if (!node) return

    setDecks((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d
        const effective = d.playbackRate + deltaRate
        node.setPlaybackRate(effective)
        return { ...d, isNudging: deltaRate !== 0, nudgeAmount: deltaRate }
      })
    )
  }

  const handlePitchChange = (id: DeckId, offsetPercent: number) => {
    const node = getAudioEngine().getDeck(id)
    if (!node) return

    const rate = 1.0 + offsetPercent / 100
    node.setPlaybackRate(rate)

    const otherDeckId = id === activeLeftDeckId ? activeRightDeckId : activeLeftDeckId

    setDecks((prev) => {
      const currentDeck = prev.find((d) => d.id === id)
      const currentBaseBpm = currentDeck?.track?.bpm || 120
      const currentEffectiveBpm = currentBaseBpm * rate

      return prev.map((d) => {
        if (d.id === id) {
          // Manual slider movement on this deck: update offset and rate.
          // Note: if it was synced, moving the fader manually disengages sync
          return { ...d, pitchOffset: offsetPercent, playbackRate: rate, sync: false }
        }

        // If the other active deck has SYNC ON, it automatically tracks this deck's tempo!
        if (d.id === otherDeckId && d.sync && d.track) {
          const followerBaseBpm = d.track.bpm || 120
          // Intelligent ratio matching (1:1, half-time, double-time)
          const r1 = currentEffectiveBpm / followerBaseBpm
          const rHalf = (currentEffectiveBpm * 0.5) / followerBaseBpm
          const rDouble = (currentEffectiveBpm * 2.0) / followerBaseBpm
          const candidates = [r1, rHalf, rDouble]
          let bestR = r1
          let minDiff = Math.abs(r1 - 1.0)
          for (const cand of candidates) {
            if (Math.abs(cand - 1.0) < minDiff) {
              minDiff = Math.abs(cand - 1.0)
              bestR = cand
            }
          }
          const otherNode = getAudioEngine().getDeck(otherDeckId)
          if (otherNode) otherNode.setPlaybackRate(bestR)
          const followerOffset = (bestR - 1.0) * 100
          return { ...d, pitchOffset: followerOffset, playbackRate: bestR }
        }

        return d
      })
    })
  }

  const handlePitchRangeCycle = (id: DeckId) => {
    const ranges: (6 | 10 | 16 | 100)[] = [6, 10, 16, 100]
    setDecks((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d
        const nextIdx = (ranges.indexOf(d.pitchRange) + 1) % ranges.length
        return { ...d, pitchRange: ranges[nextIdx] }
      })
    )
  }

  const handleKeyLockToggle = (id: DeckId) => {
    setDecks((prev) =>
      prev.map((d) => (d.id === id ? { ...d, keyLock: !d.keyLock } : d))
    )
  }

  const handleSyncToggle = (id: DeckId) => {
    const currentDeck = decks.find((d) => d.id === id)
    if (!currentDeck) return

    // 1. If SYNC is already active, clicking SYNC toggles it OFF!
    if (currentDeck.sync) {
      setDecks((prev) =>
        prev.map((d) => (d.id === id ? { ...d, sync: false } : d))
      )
      return
    }

    // 2. Identify the other deck to sync to
    const otherDeckId = id === activeLeftDeckId ? activeRightDeckId : activeLeftDeckId
    const targetDeck = decks.find((d) => d.id === otherDeckId)

    if (!targetDeck?.track || !currentDeck?.track) {
      setDecks((prev) =>
        prev.map((d) => (d.id === id ? { ...d, sync: true } : d))
      )
      return
    }

    const targetBpm = (targetDeck.track.bpm || 120) * targetDeck.playbackRate
    const currentBaseBpm = currentDeck.track.bpm || 120

    // Intelligent Multi-rate matching (1:1, half-time, double-time)
    // Find the rate ratio closest to 1.0 (minimal pitch shift)
    const ratio1 = targetBpm / currentBaseBpm
    const ratioHalf = (targetBpm * 0.5) / currentBaseBpm
    const ratioDouble = (targetBpm * 2.0) / currentBaseBpm

    const candidates = [ratio1, ratioHalf, ratioDouble]
    let bestRatio = ratio1
    let minDiff = Math.abs(ratio1 - 1.0)

    for (const r of candidates) {
      const diff = Math.abs(r - 1.0)
      if (diff < minDiff) {
        minDiff = diff
        bestRatio = r
      }
    }

    const effectiveTargetBpm = currentBaseBpm * bestRatio
    const offset = (bestRatio - 1.0) * 100

    // Apply the matched tempo to the audio node
    const currentNode = getAudioEngine().getDeck(id)
    if (currentNode) currentNode.setPlaybackRate(bestRatio)

    // Phase alignment: snap to the nearest kick drum / beat grid
    const targetNode = getAudioEngine().getDeck(otherDeckId)

    if (targetNode && currentNode && targetDeck.isPlaying) {
      const targetTime = targetNode.getCurrentTime()
      const currTime = currentNode.getCurrentTime()
      const beatInterval = 60 / effectiveTargetBpm

      // Exact modulo phase in range [0, beatInterval)
      const targetPhase = ((targetTime % beatInterval) + beatInterval) % beatInterval
      const currPhase = ((currTime % beatInterval) + beatInterval) % beatInterval

      // Calculate minimal phase difference (-halfBeat to +halfBeat)
      let phaseDelta = targetPhase - currPhase
      if (phaseDelta > beatInterval / 2) phaseDelta -= beatInterval
      if (phaseDelta < -beatInterval / 2) phaseDelta += beatInterval

      const alignedTime = Math.max(0, currTime + phaseDelta)
      currentNode.seek(alignedTime)

      setDecks((prev) =>
        prev.map((d) =>
          d.id === id
            ? { ...d, sync: true, pitchOffset: offset, playbackRate: bestRatio, currentTime: alignedTime }
            : d
        )
      )
    } else {
      setDecks((prev) =>
        prev.map((d) =>
          d.id === id
            ? { ...d, sync: true, pitchOffset: offset, playbackRate: bestRatio }
            : d
        )
      )
    }
  }

  const handlePitchBend = (id: DeckId, direction: -1 | 1 | 0) => {
    const delta = direction * 0.05
    handleNudge(id, delta)
  }

  // Hot Cues
  const handleSetHotCue = (deckId: DeckId, index: number) => {
    ensureAudioResumed()
    const node = getAudioEngine().getDeck(deckId)
    if (!node) return

    setDecks((prev) =>
      prev.map((d) => {
        if (d.id !== deckId) return d
        const existing = d.hotCues[index]
        if (existing !== null && existing !== undefined) {
          node.seek(existing)
          if (!d.isPlaying) node.play()
          return { ...d, currentTime: existing, isPlaying: true }
        } else {
          const cues = [...d.hotCues]
          cues[index] = node.getCurrentTime()
          return { ...d, hotCues: cues }
        }
      })
    )
  }

  const handleClearHotCue = (deckId: DeckId, index: number) => {
    setDecks((prev) =>
      prev.map((d) => {
        if (d.id !== deckId) return d
        const cues = [...d.hotCues]
        cues[index] = null
        return { ...d, hotCues: cues }
      })
    )
  }

  // Loops
  const handleTriggerLoop = (deckId: DeckId, beats: number) => {
    ensureAudioResumed()
    const node = getAudioEngine().getDeck(deckId)
    if (!node) return

    setDecks((prev) =>
      prev.map((d) => {
        if (d.id !== deckId) return d
        const currentBpm = (d.track?.bpm || 120) * d.playbackRate
        const beatSec = 60 / currentBpm
        const loopLen = beats * beatSec

        if (d.loop.active && d.loop.beats === beats) {
          return { ...d, loop: { ...d.loop, active: false } }
        }

        const start = node.getCurrentTime()
        const end = start + loopLen
        return {
          ...d,
          loop: { active: true, start, end, beats },
        }
      })
    )
  }

  const handleToggleLoop = (deckId: DeckId) => {
    const node = getAudioEngine().getDeck(deckId)
    setDecks((prev) =>
      prev.map((d) => {
        if (d.id !== deckId) return d
        const nextActive = !d.loop.active
        // If re-activating loop (RELOOP), jump back to loop start if currently outside the loop!
        if (nextActive && node) {
          const pos = node.getCurrentTime()
          if (pos < d.loop.start || pos >= d.loop.end) {
            node.seek(d.loop.start)
            return { ...d, currentTime: d.loop.start, loop: { ...d.loop, active: true } }
          }
        }
        return { ...d, loop: { ...d.loop, active: nextActive } }
      })
    )
  }

  const handleHalveLoop = (deckId: DeckId) => {
    setDecks((prev) =>
      prev.map((d) => {
        if (d.id !== deckId || !d.loop.active) return d
        const newBeats = d.loop.beats / 2
        const currentBpm = (d.track?.bpm || 120) * d.playbackRate
        const loopLen = newBeats * (60 / currentBpm)
        return {
          ...d,
          loop: {
            ...d.loop,
            beats: newBeats,
            end: d.loop.start + loopLen,
          },
        }
      })
    )
  }

  const handleDoubleLoop = (deckId: DeckId) => {
    setDecks((prev) =>
      prev.map((d) => {
        if (d.id !== deckId || !d.loop.active) return d
        const newBeats = d.loop.beats * 2
        const currentBpm = (d.track?.bpm || 120) * d.playbackRate
        const loopLen = newBeats * (60 / currentBpm)
        return {
          ...d,
          loop: {
            ...d.loop,
            beats: newBeats,
            end: d.loop.start + loopLen,
          },
        }
      })
    )
  }

  const handleLoopIn = (deckId: DeckId) => {
    const node = getAudioEngine().getDeck(deckId)
    if (!node) return
    const pos = node.getCurrentTime()
    setDecks((prev) =>
      prev.map((d) => {
        if (d.id !== deckId) return d
        // If loop is already active, clicking IN acts as CDJ Loop Cue:
        // jumps back to loop start and continues looping!
        if (d.loop.active) {
          node.seek(d.loop.start)
          return { ...d, currentTime: d.loop.start }
        }
        // If loop not active, sets start point!
        return {
          ...d,
          loop: {
            ...d.loop,
            start: pos,
            end: Math.max(pos + 1, d.loop.end),
          },
        }
      })
    )
  }

  const handleLoopOut = (deckId: DeckId) => {
    const node = getAudioEngine().getDeck(deckId)
    if (!node) return
    const pos = node.getCurrentTime()
    setDecks((prev) =>
      prev.map((d) => {
        if (d.id !== deckId) return d

        // SMART LOOP EXIT:
        // If loop is already active, clicking OUT acts as EXIT (like on CDJs)!
        if (d.loop.active) {
          return {
            ...d,
            loop: {
              ...d.loop,
              active: false,
            },
          }
        }

        // SMART LOOP CLOSING:
        const currentBpm = (d.track?.bpm || 120) * d.playbackRate
        const beatSec = 60 / currentBpm
        const hasValidStart = d.loop.start > 0 && pos > d.loop.start

        let loopStart = d.loop.start
        let smartBeats = 4
        let smartEnd = pos

        if (hasValidStart) {
          loopStart = d.loop.start
          const rawDuration = Math.max(0.1, pos - loopStart)
          const rawBeats = rawDuration / beatSec
          smartBeats = Math.max(1, Math.round(rawBeats))
          smartEnd = loopStart + smartBeats * beatSec
        } else {
          // If IN was not set, smart catch last 4 beats!
          smartBeats = 4
          loopStart = Math.max(0, pos - smartBeats * beatSec)
          smartEnd = pos
        }

        return {
          ...d,
          loop: {
            start: loopStart,
            end: smartEnd,
            beats: smartBeats,
            active: true,
          },
        }
      })
    )
  }

  // FX Handlers
  const handleToggleFX = (deckId: DeckId) => {
    const node = getAudioEngine().getDeck(deckId)
    if (!node) return

    setDecks((prev) =>
      prev.map((d) => {
        if (d.id !== deckId) return d
        const nextEnabled = !d.fx.enabled
        // When engaging FX, ensure dryWet is at least 0.5 so effect is immediately audible
        const nextDryWet = nextEnabled && d.fx.dryWet < 0.1 ? 0.5 : d.fx.dryWet
        const nextFX = { ...d.fx, enabled: nextEnabled, dryWet: nextDryWet }
        node.setFX(nextFX, (d.track?.bpm || 120) * d.playbackRate)
        return { ...d, fx: nextFX }
      })
    )
  }

  const handleChangeFXType = (deckId: DeckId, type: FXType) => {
    const node = getAudioEngine().getDeck(deckId)
    if (!node) return

    setDecks((prev) =>
      prev.map((d) => {
        if (d.id !== deckId) return d
        const nextFX = { ...d.fx, type }
        node.setFX(nextFX, (d.track?.bpm || 120) * d.playbackRate)
        return { ...d, fx: nextFX }
      })
    )
  }

  const handleChangeFXDryWet = (deckId: DeckId, val: number) => {
    const node = getAudioEngine().getDeck(deckId)
    if (!node) return

    setDecks((prev) =>
      prev.map((d) => {
        if (d.id !== deckId) return d
        const nextFX = { ...d.fx, dryWet: val }
        node.setFX(nextFX, (d.track?.bpm || 120) * d.playbackRate)
        return { ...d, fx: nextFX }
      })
    )
  }

  const handleChangeFXParam = (deckId: DeckId, val: number) => {
    const node = getAudioEngine().getDeck(deckId)
    if (!node) return

    setDecks((prev) =>
      prev.map((d) => {
        if (d.id !== deckId) return d
        const nextFX = { ...d.fx, param: val }
        node.setFX(nextFX, (d.track?.bpm || 120) * d.playbackRate)
        return { ...d, fx: nextFX }
      })
    )
  }

  // Mixer Channel Handlers
  const handleChangeEQ = (deckId: DeckId, eq: DeckState['eq']) => {
    const node = getAudioEngine().getDeck(deckId)
    if (node) node.setEQ(eq)
    setDecks((prev) => prev.map((d) => (d.id === deckId ? { ...d, eq } : d)))
  }

  const handleChangeFilter = (deckId: DeckId, val: number) => {
    const node = getAudioEngine().getDeck(deckId)
    if (node) node.setColorFilter(val)
    setDecks((prev) => prev.map((d) => (d.id === deckId ? { ...d, filter: val } : d)))
  }

  const handleChangeTrim = (deckId: DeckId, val: number) => {
    const node = getAudioEngine().getDeck(deckId)
    if (node) node.setTrim(val)
    setDecks((prev) => prev.map((d) => (d.id === deckId ? { ...d, trim: val } : d)))
  }

  const handleChangeVolume = (deckId: DeckId, val: number) => {
    const node = getAudioEngine().getDeck(deckId)
    if (node) node.setVolume(val)
    setDecks((prev) => prev.map((d) => (d.id === deckId ? { ...d, volume: val } : d)))
  }

  const handleToggleCue = (deckId: DeckId) => {
    const node = getAudioEngine().getDeck(deckId)
    setDecks((prev) =>
      prev.map((d) => {
        if (d.id !== deckId) return d
        const nextCue = !d.headphoneCue
        if (node) node.setCue(nextCue)
        return { ...d, headphoneCue: nextCue }
      })
    )
  }

  const handleChangeCrossfaderAssign = (deckId: DeckId, assign: 'A' | 'THRU' | 'B') => {
    getAudioEngine().setDeckCrossfaderAssign(deckId, assign)
    setDecks((prev) =>
      prev.map((d) => (d.id === deckId ? { ...d, crossfaderAssign: assign } : d))
    )
  }

  // Master & Mixer global handlers
  const handleChangeCrossfader = (val: number) => {
    getAudioEngine().updateCrossfader(val, mixerState.crossfaderCurve)
    setMixerState((prev) => ({ ...prev, crossfader: val }))
  }

  const handleChangeCrossfaderCurve = (curve: MixerState['crossfaderCurve']) => {
    getAudioEngine().updateCrossfader(mixerState.crossfader, curve)
    setMixerState((prev) => ({ ...prev, crossfaderCurve: curve }))
  }

  const handleChangeMasterVolume = (val: number) => {
    getAudioEngine().setMasterVolume(val)
    setMixerState((prev) => ({ ...prev, masterVolume: val }))
  }

  const handleChangeHeadphoneVolume = (val: number) => {
    getAudioEngine().setHeadphoneVolume(val)
    setMixerState((prev) => ({ ...prev, headphoneVolume: val }))
  }

  const handleChangeHeadphoneMix = (val: number) => {
    getAudioEngine().updateHeadphoneMix(val, mixerState.splitCue)
    setMixerState((prev) => ({ ...prev, headphoneMix: val }))
  }

  const handleToggleSplitCue = () => {
    const nextSplit = !mixerState.splitCue
    getAudioEngine().updateHeadphoneMix(mixerState.headphoneMix, nextSplit)
    setMixerState((prev) => ({ ...prev, splitCue: nextSplit }))
  }

  // Open library targeted for a specific deck
  const handleOpenLibraryForDeck = (deckId: DeckId) => {
    setTargetDeckForLibrary(deckId)
    setIsLibraryOpen(true)
  }

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'SELECT'
      ) {
        return
      }

      ensureAudioResumed()

      const key = e.key.toUpperCase()

      // Quick library toggle
      if (key === 'B' || key === 'TAB') {
        e.preventDefault()
        setTargetDeckForLibrary(undefined)
        setIsLibraryOpen((prev) => !prev)
        return
      }

      // Deck A (Left Active Deck)
      if (key === 'W') handlePlayPause(activeLeftDeckId)
      else if (key === 'Q') handleCueDown(activeLeftDeckId)
      else if (key === 'E') handlePitchBend(activeLeftDeckId, -1)
      else if (key === 'R') handlePitchBend(activeLeftDeckId, 1)
      else if (key === 'S') handleSyncToggle(activeLeftDeckId)
      else if (['1', '2', '3', '4'].includes(key)) {
        handleSetHotCue(activeLeftDeckId, parseInt(key, 10) - 1)
      }

      // Deck B (Right Active Deck)
      else if (key === 'I') handlePlayPause(activeRightDeckId)
      else if (key === 'U') handleCueDown(activeRightDeckId)
      else if (key === 'O') handlePitchBend(activeRightDeckId, -1)
      else if (key === 'P') handlePitchBend(activeRightDeckId, 1)
      else if (key === 'K') handleSyncToggle(activeRightDeckId)
      else if (['7', '8', '9', '0'].includes(key)) {
        const idx = key === '0' ? 3 : parseInt(key, 10) - 7
        handleSetHotCue(activeRightDeckId, idx)
      }

      // Crossfader
      else if (key === 'X') handleChangeCrossfader(-1)
      else if (key === 'C') handleChangeCrossfader(0)
      else if (key === 'V') handleChangeCrossfader(1)
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase()
      if (key === 'Q') handleCueUp(activeLeftDeckId)
      if (key === 'U') handleCueUp(activeRightDeckId)
      if (key === 'E' || key === 'R') handlePitchBend(activeLeftDeckId, 0)
      if (key === 'O' || key === 'P') handlePitchBend(activeRightDeckId, 0)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [ensureAudioResumed, activeLeftDeckId, activeRightDeckId])

  const leftDeck = decks.find((d) => d.id === activeLeftDeckId) || decks[0]
  const rightDeck = decks.find((d) => d.id === activeRightDeckId) || decks[1]

  const leftColor = activeLeftDeckId === 'A' ? '#00e5ff' : '#ffaa00'
  const rightColor = activeRightDeckId === 'B' ? '#ff3366' : '#a855f7'

  return (
    <div
      onClick={ensureAudioResumed}
      className="flex flex-col w-screen h-screen bg-[#08090d] text-neutral-200 overflow-hidden font-sans select-none"
    >
      {/* Top Bar with Settings & 2/4 Deck Quick Toggle */}
      <TopBar
        audioReady={audioReady}
        isFourDeckMode={isFourDeckMode}
        onOpenLibrary={() => {
          setTargetDeckForLibrary(undefined)
          setIsLibraryOpen(true)
        }}
        onToggleDeckMode={() => handleSetDeckMode(!isFourDeckMode)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleKeyboardHelp={() => setIsKeyboardHelpOpen(true)}
        onToggleFullscreen={() => {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => { })
          } else {
            document.exitFullscreen().catch(() => { })
          }
        }}
      />

      {/* Main DJ Console Workspace */}
      <div className="flex-1 flex flex-col overflow-y-auto p-3 gap-3">
        {/* Center Stacked 60 FPS Waveforms */}
        <StackedWaveforms
          deckA={leftDeck}
          deckB={rightDeck}
          getCurrentTimeA={() => getAudioEngine().getDeck(activeLeftDeckId)?.getCurrentTime() || 0}
          getCurrentTimeB={() => getAudioEngine().getDeck(activeRightDeckId)?.getCurrentTime() || 0}
          onSeekA={(time) => handleSeek(activeLeftDeckId, time)}
          onSeekB={(time) => handleSeek(activeRightDeckId, time)}
        />

          {/* Mobile View Switcher Pills (Hidden on desktop xl:) */}
          <div className="xl:hidden flex items-center justify-between gap-1.5 p-1 bg-[#0b0d14] rounded-xl border border-[#1e2333] shrink-0">
            <button
              onClick={() => setMobileActiveTab('A')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-mono font-bold transition-all text-center ${mobileActiveTab === 'A'
                  ? 'bg-[#00e5ff] text-black shadow-[0_0_10px_rgba(0,229,255,0.4)]'
                  : 'text-neutral-400 hover:text-white hover:bg-[#151824]'
                }`}
            >
              DECK {activeLeftDeckId}
            </button>
            <button
              onClick={() => setMobileActiveTab('mixer')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-mono font-bold transition-all text-center ${mobileActiveTab === 'mixer'
                  ? 'bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.4)]'
                  : 'text-neutral-400 hover:text-white hover:bg-[#151824]'
                }`}
            >
              MIXER
            </button>
            <button
              onClick={() => setMobileActiveTab('B')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-mono font-bold transition-all text-center ${mobileActiveTab === 'B'
                  ? 'bg-[#ff3366] text-white shadow-[0_0_10px_rgba(255,51,102,0.4)]'
                  : 'text-neutral-400 hover:text-white hover:bg-[#151824]'
                }`}
            >
              DECK {activeRightDeckId}
            </button>
            <button
              onClick={() => setMobileActiveTab('both')}
              className={`py-1.5 px-3 rounded-lg text-xs font-mono font-bold transition-all text-center ${mobileActiveTab === 'both'
                  ? 'bg-[#a855f7] text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                  : 'text-neutral-400 hover:text-white hover:bg-[#151824]'
                }`}
            >
              ALL
            </button>
          </div>

          {/* Main DJ Console Workspace: 3-column side-by-side on desktop (xl:), responsive tabbed on mobile */}
          <div className="flex flex-col xl:flex-row items-center xl:items-start justify-start xl:justify-center gap-3.5 flex-1 xl:min-h-[520px]">
            {/* Left Physical Deck */}
            <div className={`w-full xl:w-auto justify-center ${mobileActiveTab === 'A' || mobileActiveTab === 'both' ? 'flex' : 'hidden xl:flex'}`}>
              <DeckView
                deck={leftDeck}
                color={leftColor}
                altDeckId={isFourDeckMode ? (activeLeftDeckId === 'A' ? 'C' : 'A') : undefined}
                onFlipDeck={() =>
                  setActiveLeftDeckId((prev) => (prev === 'A' ? 'C' : 'A'))
                }
                onToggleVinylMode={() => handleToggleVinylMode(leftDeck.id)}
                onOpenLibraryForDeck={() => handleOpenLibraryForDeck(leftDeck.id)}
                onPlayPause={() => handlePlayPause(leftDeck.id)}
                onCueDown={() => handleCueDown(leftDeck.id)}
                onCueUp={() => handleCueUp(leftDeck.id)}
                onSeek={(t) => handleSeek(leftDeck.id, t)}
                onStartScratch={() => handleStartScratch(leftDeck.id)}
                onScratch={(d, v) => handleScratch(leftDeck.id, d, v)}
                onStopScratch={() => handleStopScratch(leftDeck.id)}
                onNudge={(n) => handleNudge(leftDeck.id, n)}
                onPitchChange={(p) => handlePitchChange(leftDeck.id, p)}
                onPitchRangeCycle={() => handlePitchRangeCycle(leftDeck.id)}
                onKeyLockToggle={() => handleKeyLockToggle(leftDeck.id)}
                onSyncToggle={() => handleSyncToggle(leftDeck.id)}
                onPitchBend={(dir) => handlePitchBend(leftDeck.id, dir)}
                onSetHotCue={(idx) => handleSetHotCue(leftDeck.id, idx)}
                onClearHotCue={(idx) => handleClearHotCue(leftDeck.id, idx)}
                onTriggerLoop={(beats) => handleTriggerLoop(leftDeck.id, beats)}
                onToggleLoop={() => handleToggleLoop(leftDeck.id)}
                onHalveLoop={() => handleHalveLoop(leftDeck.id)}
                onDoubleLoop={() => handleDoubleLoop(leftDeck.id)}
                onLoopIn={() => handleLoopIn(leftDeck.id)}
                onLoopOut={() => handleLoopOut(leftDeck.id)}
                onToggleFX={() => handleToggleFX(leftDeck.id)}
                onChangeFXType={(t) => handleChangeFXType(leftDeck.id, t)}
                onChangeFXDryWet={(w) => handleChangeFXDryWet(leftDeck.id, w)}
                onChangeFXParam={(p) => handleChangeFXParam(leftDeck.id, p)}
                onDropFileOrTrack={(item) => handleDropOnDeck(item, leftDeck.id)}
              />
            </div>

            {/* Central DJ Mixer */}
            <div className={`w-full xl:w-auto justify-center ${mobileActiveTab === 'mixer' || mobileActiveTab === 'both' ? 'flex' : 'hidden xl:flex'}`}>
              <MixerSection
                decks={decks}
                activeLeftDeckId={activeLeftDeckId}
                activeRightDeckId={activeRightDeckId}
                mixerState={mixerState}
                onChangeEQ={handleChangeEQ}
                onChangeFilter={handleChangeFilter}
                onChangeTrim={handleChangeTrim}
                onChangeVolume={handleChangeVolume}
                onToggleCue={handleToggleCue}
                onChangeCrossfaderAssign={handleChangeCrossfaderAssign}
                onChangeCrossfader={handleChangeCrossfader}
                onChangeCrossfaderCurve={handleChangeCrossfaderCurve}
                onChangeMasterVolume={handleChangeMasterVolume}
                onChangeHeadphoneVolume={handleChangeHeadphoneVolume}
                onChangeHeadphoneMix={handleChangeHeadphoneMix}
                onToggleSplitCue={handleToggleSplitCue}
              />
            </div>

            {/* Right Physical Deck */}
            <div className={`w-full xl:w-auto justify-center ${mobileActiveTab === 'B' || mobileActiveTab === 'both' ? 'flex' : 'hidden xl:flex'}`}>
              <DeckView
                deck={rightDeck}
                color={rightColor}
                altDeckId={isFourDeckMode ? (activeRightDeckId === 'B' ? 'D' : 'B') : undefined}
                onFlipDeck={() =>
                  setActiveRightDeckId((prev) => (prev === 'B' ? 'D' : 'B'))
                }
                onToggleVinylMode={() => handleToggleVinylMode(rightDeck.id)}
                onOpenLibraryForDeck={() => handleOpenLibraryForDeck(rightDeck.id)}
                onPlayPause={() => handlePlayPause(rightDeck.id)}
                onCueDown={() => handleCueDown(rightDeck.id)}
                onCueUp={() => handleCueUp(rightDeck.id)}
                onSeek={(t) => handleSeek(rightDeck.id, t)}
                onStartScratch={() => handleStartScratch(rightDeck.id)}
                onScratch={(d, v) => handleScratch(rightDeck.id, d, v)}
                onStopScratch={() => handleStopScratch(rightDeck.id)}
                onNudge={(n) => handleNudge(rightDeck.id, n)}
                onPitchChange={(p) => handlePitchChange(rightDeck.id, p)}
                onPitchRangeCycle={() => handlePitchRangeCycle(rightDeck.id)}
                onKeyLockToggle={() => handleKeyLockToggle(rightDeck.id)}
                onSyncToggle={() => handleSyncToggle(rightDeck.id)}
                onPitchBend={(dir) => handlePitchBend(rightDeck.id, dir)}
                onSetHotCue={(idx) => handleSetHotCue(rightDeck.id, idx)}
                onClearHotCue={(idx) => handleClearHotCue(rightDeck.id, idx)}
                onTriggerLoop={(beats) => handleTriggerLoop(rightDeck.id, beats)}
                onToggleLoop={() => handleToggleLoop(rightDeck.id)}
                onHalveLoop={() => handleHalveLoop(rightDeck.id)}
                onDoubleLoop={() => handleDoubleLoop(rightDeck.id)}
                onLoopIn={() => handleLoopIn(rightDeck.id)}
                onLoopOut={() => handleLoopOut(rightDeck.id)}
                onToggleFX={() => handleToggleFX(rightDeck.id)}
                onChangeFXType={(t) => handleChangeFXType(rightDeck.id, t)}
                onChangeFXDryWet={(w) => handleChangeFXDryWet(rightDeck.id, w)}
                onChangeFXParam={(p) => handleChangeFXParam(rightDeck.id, p)}
                onDropFileOrTrack={(item) => handleDropOnDeck(item, rightDeck.id)}
              />
            </div>
          </div>

          {/* Mobile Quick-Crossfader Strip (Visible only when in Single Deck View on mobile for easy DJ transitions) */}
          {(mobileActiveTab === 'A' || mobileActiveTab === 'B') && (
            <div className="xl:hidden flex items-center justify-between gap-3 px-4 py-2.5 bg-[#0e1018] border border-[#23283a] rounded-xl shadow-lg shrink-0 w-full max-w-lg mx-auto">
              <span
                className="text-[11px] font-mono font-bold"
                style={{ color: leftColor }}
              >
                DECK {activeLeftDeckId}
              </span>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.01"
                value={mixerState.crossfader}
                onChange={(e) => handleChangeCrossfader(parseFloat(e.target.value))}
                className="flex-1 accent-[#00e5ff] cursor-pointer h-2 bg-[#1c202e] rounded-lg touch-none"
                style={{ touchAction: 'none' }}
                title="Quick Crossfader"
              />
              <span
                className="text-[11px] font-mono font-bold"
                style={{ color: rightColor }}
              >
                DECK {activeRightDeckId}
              </span>
            </div>
          )}
        </div>

        {/* Full Popup Track Library Modal */}
        <LibraryModal
          isOpen={isLibraryOpen}
          tracks={tracks}
          isFourDeckMode={isFourDeckMode}
          targetDeckId={targetDeckForLibrary}
          lastSelectedTrackId={lastSelectedTrackId}
          onClose={() => {
            setIsLibraryOpen(false)
            setTargetDeckForLibrary(undefined)
          }}
          onAddTracks={(newTracks) => {
            setTracks((prev) => {
              const updated = [...prev, ...newTracks]
              TrackDatabase.saveLibrary(updated)
              return updated
            })
          }}
          onClearLibrary={() => {
            TrackDatabase.clearLibrary()
            setTracks([])
          }}
          onLoadTrackToDeck={(track, deckId) => handleLoadTrack(track, deckId)}
          onLoadOnlineTrackToDeck={handleLoadOnlineTrackToDeck}
        />

        {/* Settings Modal */}
        <SettingsModal
          isOpen={isSettingsOpen}
          isFourDeckMode={isFourDeckMode}
          crossfaderCurve={mixerState.crossfaderCurve}
          onClose={() => setIsSettingsOpen(false)}
          onToggleDeckMode={handleSetDeckMode}
          onChangeCrossfaderCurve={handleChangeCrossfaderCurve}
        />

        {/* Keyboard Shortcuts Modal */}
        <KeyboardModal
          isOpen={isKeyboardHelpOpen}
          onClose={() => setIsKeyboardHelpOpen(false)}
        />
      </div>
      )
}
      export default App
