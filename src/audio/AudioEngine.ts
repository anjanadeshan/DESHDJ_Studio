import type { CrossfaderCurve, DeckId, MixerState } from '../types/dj'
import { DeckAudioNode } from './DeckAudioNode'

export class AudioEngine {
  private static instance: AudioEngine | null = null
  public ctx: AudioContext
  public decks: Map<DeckId, DeckAudioNode> = new Map()

  // Master bus
  public masterGain: GainNode
  public masterAnalyser: AnalyserNode

  // Crossfader buses
  private busA: GainNode
  private busB: GainNode
  private busThru: GainNode

  // Headphone / Cue bus
  public cueGain: GainNode
  public cueAnalyser: AnalyserNode
  private headphoneMixGainMaster: GainNode
  private headphoneMixGainCue: GainNode
  private headphoneOutputGain: GainNode

  // Split-cue panner nodes
  private masterSplitPanner: StereoPannerNode
  private cueSplitPanner: StereoPannerNode

  private mixerState: MixerState = {
    crossfader: 0,
    crossfaderCurve: 'smooth',
    masterVolume: 0.85,
    masterLevel: { left: 0, right: 0 },
    headphoneVolume: 0.8,
    headphoneMix: 0.5,
    splitCue: false,
  }

  private constructor() {
    // Initialize Web Audio Context
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.ctx = new AudioContextClass({ latencyHint: 'interactive' })

    // Master bus
    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = this.mixerState.masterVolume

    this.masterAnalyser = this.ctx.createAnalyser()
    this.masterAnalyser.fftSize = 256
    this.masterAnalyser.smoothingTimeConstant = 0.5

    // Crossfader buses
    this.busA = this.ctx.createGain()
    this.busB = this.ctx.createGain()
    this.busThru = this.ctx.createGain()

    this.busA.connect(this.masterGain)
    this.busB.connect(this.masterGain)
    this.busThru.connect(this.masterGain)

    // Master -> Analyser -> Destination
    this.masterGain.connect(this.masterAnalyser)
    this.masterGain.connect(this.ctx.destination)

    // Headphone monitoring bus
    this.cueGain = this.ctx.createGain()
    this.cueAnalyser = this.ctx.createAnalyser()
    this.cueAnalyser.fftSize = 256

    this.headphoneMixGainMaster = this.ctx.createGain()
    this.headphoneMixGainCue = this.ctx.createGain()
    this.headphoneOutputGain = this.ctx.createGain()
    this.headphoneOutputGain.gain.value = this.mixerState.headphoneVolume

    this.masterSplitPanner = this.ctx.createStereoPanner()
    this.cueSplitPanner = this.ctx.createStereoPanner()

    this.masterGain.connect(this.headphoneMixGainMaster)
    this.cueGain.connect(this.headphoneMixGainCue)
    this.cueGain.connect(this.cueAnalyser)

    this.headphoneMixGainMaster.connect(this.headphoneOutputGain)
    this.headphoneMixGainCue.connect(this.headphoneOutputGain)

    // Initialize Decks A & B
    this.createDeck('A')
    this.createDeck('B')
    this.createDeck('C')
    this.createDeck('D')

    this.updateCrossfader(0, 'smooth')
    this.updateHeadphoneMix(0.5, false)
  }

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine()
    }
    return AudioEngine.instance
  }

  public async resume(): Promise<void> {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume()
    }
  }

  public createDeck(id: DeckId): DeckAudioNode {
    if (this.decks.has(id)) {
      return this.decks.get(id)!
    }

    const deck = new DeckAudioNode(id, this.ctx)
    this.decks.set(id, deck)

    // Connect Deck Master Send according to default assignment
    // Deck A -> busA, Deck B -> busB, Deck C -> busA, Deck D -> busB
    const targetBus = id === 'A' || id === 'C' ? this.busA : this.busB
    deck.masterSend.connect(targetBus)

    // Connect Deck Cue Send to Central Cue Gain
    deck.cueSend.connect(this.cueGain)

    return deck
  }

  public getDeck(id: DeckId): DeckAudioNode | undefined {
    return this.decks.get(id)
  }

  public setDeckCrossfaderAssign(id: DeckId, assign: 'A' | 'THRU' | 'B') {
    const deck = this.decks.get(id)
    if (!deck) return

    try {
      deck.masterSend.disconnect()
    } catch {
      // ignore
    }

    if (assign === 'A') {
      deck.masterSend.connect(this.busA)
    } else if (assign === 'B') {
      deck.masterSend.connect(this.busB)
    } else {
      deck.masterSend.connect(this.busThru)
    }
  }

  public updateCrossfader(pos: number, curve: CrossfaderCurve) {
    this.mixerState.crossfader = pos
    this.mixerState.crossfaderCurve = curve

    const now = this.ctx.currentTime
    let gainA = 1
    let gainB = 1

    if (curve === 'smooth') {
      // Constant Power Crossfade: cos & sin curve
      const x = (pos + 1) * 0.25 * Math.PI // 0 to PI/2
      gainA = Math.cos(x)
      gainB = Math.sin(x)
    } else {
      // Sharp Scratch Cut curve: full gain across 90% of range, sharp cut at edge
      if (pos < -0.92) {
        gainA = 1
        gainB = 0
      } else if (pos > 0.92) {
        gainA = 0
        gainB = 1
      } else {
        gainA = 1
        gainB = 1
      }
    }

    this.busA.gain.setTargetAtTime(gainA, now, 0.01)
    this.busB.gain.setTargetAtTime(gainB, now, 0.01)
  }

  public setMasterVolume(vol: number) {
    this.mixerState.masterVolume = vol
    const gain = Math.pow(Math.max(0, Math.min(1, vol)), 2)
    this.masterGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.01)
  }

  public setHeadphoneVolume(vol: number) {
    this.mixerState.headphoneVolume = vol
    const gain = Math.pow(Math.max(0, Math.min(1, vol)), 2)
    this.headphoneOutputGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.01)
  }

  public updateHeadphoneMix(mix: number, split: boolean) {
    this.mixerState.headphoneMix = mix
    this.mixerState.splitCue = split
    const now = this.ctx.currentTime

    if (split) {
      // Split mode: Cue in Left ear, Master in Right ear
      this.cueSplitPanner.pan.setTargetAtTime(-1, now, 0.01)
      this.masterSplitPanner.pan.setTargetAtTime(1, now, 0.01)
      this.headphoneMixGainCue.gain.setTargetAtTime(1, now, 0.01)
      this.headphoneMixGainMaster.gain.setTargetAtTime(1, now, 0.01)
    } else {
      // Stereo blend: 0 = 100% Cue, 1 = 100% Master
      const cueGain = Math.cos(mix * 0.5 * Math.PI)
      const masterGain = Math.sin(mix * 0.5 * Math.PI)
      this.headphoneMixGainCue.gain.setTargetAtTime(cueGain, now, 0.01)
      this.headphoneMixGainMaster.gain.setTargetAtTime(masterGain, now, 0.01)
    }
  }

  public getMasterLevels(): { left: number; right: number } {
    const data = new Uint8Array(this.masterAnalyser.frequencyBinCount)
    this.masterAnalyser.getByteTimeDomainData(data)

    let sum = 0
    for (let i = 0; i < data.length; i++) {
      const val = (data[i] - 128) / 128
      sum += val * val
    }
    const rms = Math.sqrt(sum / data.length)
    const level = Math.min(1.0, rms * 3.5)

    return { left: level, right: level }
  }

  public async decodeAudioFile(file: File): Promise<AudioBuffer> {
    await this.resume()
    const arrayBuffer = await file.arrayBuffer()
    return await this.ctx.decodeAudioData(arrayBuffer)
  }

  public async decodeArrayBuffer(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    await this.resume()
    return await this.ctx.decodeAudioData(arrayBuffer)
  }
}

