export type DeckId = 'A' | 'B' | 'C' | 'D'

export interface WaveformData {
  peaks: Float32Array
  lowPeaks: Float32Array
  midPeaks: Float32Array
  highPeaks: Float32Array
  length: number
}

export interface Track {
  id: string
  name: string
  title: string
  artist: string
  album: string
  duration: number
  bpm: number
  key?: string
  file?: File
  handle?: FileSystemFileHandle
  coverArtUrl?: string
  waveform?: WaveformData
  audioBuffer?: AudioBuffer
  lastLoadedAt?: number
}

export type FXType = 'echo' | 'reverb' | 'flanger' | 'bitcrusher'

export interface FXState {
  type: FXType
  enabled: boolean
  dryWet: number // 0 to 1
  param: number // 0 to 1 (e.g. echo beats / reverb decay / flanger depth / bit crush)
}

export interface LoopState {
  active: boolean
  start: number
  end: number
  beats: number
}

export interface EQState {
  high: number // -26dB to +6dB (default 0dB)
  mid: number // -26dB to +6dB
  low: number // -26dB to +6dB
  highKill: boolean
  midKill: boolean
  lowKill: boolean
}

export interface DeckState {
  id: DeckId
  track: Track | null
  isPlaying: boolean
  currentTime: number
  duration: number
  playbackRate: number // pitch percentage multiplier, e.g. 1.0 = normal
  pitchOffset: number // percentage e.g. 0% -> -8% to +8%
  pitchRange: 6 | 10 | 16 | 100
  keyLock: boolean
  vinylMode: boolean
  isScratching: boolean
  isNudging: boolean
  nudgeAmount: number
  cuePosition: number
  hotCues: (number | null)[] // 8 hot cue points in seconds
  loop: LoopState
  sync: boolean
  eq: EQState
  filter: number // -1 (LPF) to 0 (off) to +1 (HPF)
  trim: number // 0 to 2 (1 = unity / 0dB)
  volume: number // 0 to 1
  headphoneCue: boolean
  crossfaderAssign: 'A' | 'THRU' | 'B'
  fx: FXState
  level: { left: number; right: number }
}

export type CrossfaderCurve = 'smooth' | 'cut'

export interface MixerState {
  crossfader: number // -1 (Deck A) to 1 (Deck B)
  crossfaderCurve: CrossfaderCurve
  masterVolume: number // 0 to 1
  masterLevel: { left: number; right: number }
  headphoneVolume: number // 0 to 1
  headphoneMix: number // 0 = Cue, 1 = Master
  splitCue: boolean
}

