import type { DeckId, EQState, FXState } from '../types/dj'
import { EchoEffect } from './effects/EchoEffect'
import { ReverbEffect } from './effects/ReverbEffect'
import { FlangerEffect } from './effects/FlangerEffect'
import { BitcrusherEffect } from './effects/BitcrusherEffect'

export class DeckAudioNode {
  public id: DeckId
  private ctx: AudioContext
  private buffer: AudioBuffer | null = null
  private source: AudioBufferSourceNode | null = null
  private scratchGrainSource: AudioBufferSourceNode | null = null

  // Playback timing
  public isPlaying = false
  public isCuePreviewing = false
  public wasPlayingBeforeScratch = false
  private offset = 0
  private startContextTime = 0
  private currentPlaybackRate = 1.0

  // Audio Nodes
  private inputGain: GainNode
  private lowShelf: BiquadFilterNode
  private midPeak: BiquadFilterNode
  private highShelf: BiquadFilterNode
  private colorFilter: BiquadFilterNode
  private trimGain: GainNode

  // Post-Fader Effects Architecture (Pioneer Console Style Echo-Out)
  private dryGain: GainNode
  private fxSendGain: GainNode
  private fxReturnGain: GainNode

  // 4 Effects
  public echoFX: EchoEffect
  public reverbFX: ReverbEffect
  public flangerFX: FlangerEffect
  public bitcrusherFX: BitcrusherEffect
  private currentConnectedFX: 'echo' | 'reverb' | 'flanger' | 'bitcrusher' | null = null

  // Volume & Routing
  public volumeGain: GainNode
  public panner: StereoPannerNode
  public analyser: AnalyserNode
  public masterSend: GainNode
  public cueSend: GainNode

  // Scratch
  public isScratching = false

  // Callbacks
  public onTimeUpdate?: (time: number) => void
  public onTrackEnd?: () => void

  constructor(id: DeckId, ctx: AudioContext) {
    this.id = id
    this.ctx = ctx

    this.inputGain = ctx.createGain()

    // 3-Band EQ
    this.lowShelf = ctx.createBiquadFilter()
    this.lowShelf.type = 'lowshelf'
    this.lowShelf.frequency.value = 250
    this.lowShelf.gain.value = 0

    this.midPeak = ctx.createBiquadFilter()
    this.midPeak.type = 'peaking'
    this.midPeak.frequency.value = 1200
    this.midPeak.Q.value = 1.0
    this.midPeak.gain.value = 0

    this.highShelf = ctx.createBiquadFilter()
    this.highShelf.type = 'highshelf'
    this.highShelf.frequency.value = 3500
    this.highShelf.gain.value = 0

    // Sound Color Filter (High-pass / Low-pass dual knob)
    this.colorFilter = ctx.createBiquadFilter()
    this.colorFilter.type = 'allpass'
    this.colorFilter.frequency.value = 1000

    // Trim / Pre-gain
    this.trimGain = ctx.createGain()
    this.trimGain.gain.value = 1.0

    // Channel Volume Fader
    this.volumeGain = ctx.createGain()
    this.volumeGain.gain.value = 1.0

    // Dry path
    this.dryGain = ctx.createGain()
    this.dryGain.gain.value = 1.0

    // Post-Fader FX Send: fed post-channel-fader (volumeGain)
    // When the volume fader is pulled down, no new audio enters the FX,
    // but the echo repeats already in the buffer continue ringing out!
    this.fxSendGain = ctx.createGain()
    this.fxSendGain.gain.value = 0.0

    // Post-Fader FX Return: feeds directly into panner/master, bypassing the fader!
    this.fxReturnGain = ctx.createGain()
    this.fxReturnGain.gain.value = 0.0

    // Initialize 4 FX processors
    this.echoFX = new EchoEffect(ctx)
    this.reverbFX = new ReverbEffect(ctx)
    this.flangerFX = new FlangerEffect(ctx)
    this.bitcrusherFX = new BitcrusherEffect(ctx)

    this.panner = ctx.createStereoPanner()

    // Analyser for VU meter
    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 256
    this.analyser.smoothingTimeConstant = 0.5

    // Sends
    this.masterSend = ctx.createGain()
    this.cueSend = ctx.createGain()
    this.cueSend.gain.value = 0

    // 1. EQ & Filter core chain
    this.inputGain
      .connect(this.lowShelf)
      .connect(this.midPeak)
      .connect(this.highShelf)
      .connect(this.colorFilter)
      .connect(this.trimGain)

    // 2. Dry path: Trim -> DryGain -> VolumeGain (Channel Fader)
    this.trimGain.connect(this.dryGain)
    this.dryGain.connect(this.volumeGain)

    // 3. Post-Fader FX Send: VolumeGain -> fxSendGain
    this.volumeGain.connect(this.fxSendGain)

    // 4. Post-Fader FX Return: fxReturnGain -> panner (bypasses fader so echoes ring out!)
    this.fxReturnGain.connect(this.panner)

    // Connect default effect (Echo) to Send & Return
    this.connectFXToBus('echo')

    // 5. Volume -> Analyser -> Panner
    this.volumeGain.connect(this.analyser)
    this.volumeGain.connect(this.panner)

    // 6. Master send and Cue send
    this.panner.connect(this.masterSend)
    this.panner.connect(this.cueSend)
  }

  private connectFXToBus(type: 'echo' | 'reverb' | 'flanger' | 'bitcrusher') {
    if (this.currentConnectedFX === type) return

    try {
      this.fxSendGain.disconnect()
      this.echoFX.output.disconnect()
      this.reverbFX.output.disconnect()
      this.flangerFX.output.disconnect()
      this.bitcrusherFX.output.disconnect()
    } catch {
      // ignore
    }

    let targetFX: { input: GainNode; output: GainNode }
    switch (type) {
      case 'echo':
        targetFX = this.echoFX
        break
      case 'reverb':
        targetFX = this.reverbFX
        break
      case 'flanger':
        targetFX = this.flangerFX
        break
      case 'bitcrusher':
        targetFX = this.bitcrusherFX
        break
    }

    this.fxSendGain.connect(targetFX.input)
    targetFX.output.connect(this.fxReturnGain)
    this.currentConnectedFX = type
  }

  public setBuffer(buffer: AudioBuffer) {
    this.stop()
    this.buffer = buffer
    this.offset = 0
  }

  public getBuffer(): AudioBuffer | null {
    return this.buffer
  }

  public play(startTime?: number) {
    if (!this.buffer) return

    if (startTime !== undefined) {
      this.offset = Math.max(0, Math.min(this.buffer.duration, startTime))
    }

    this.stopSourceOnly()

    const source = this.ctx.createBufferSource()
    source.buffer = this.buffer
    source.playbackRate.value = this.currentPlaybackRate
    source.connect(this.inputGain)

    this.startContextTime = this.ctx.currentTime
    source.start(0, this.offset)

    source.onended = () => {
      if (this.source === source && this.isPlaying && !this.isScratching && !this.isCuePreviewing) {
        this.isPlaying = false
        if (this.onTrackEnd) this.onTrackEnd()
      }
    }

    this.source = source
    this.isPlaying = true
  }

  public pause() {
    if (!this.isPlaying && !this.isCuePreviewing) return
    this.offset = this.getCurrentTime()
    this.stopSourceOnly()
    this.isPlaying = false
    this.isCuePreviewing = false
  }

  public stop() {
    this.stopSourceOnly()
    this.offset = 0
    this.isPlaying = false
    this.isCuePreviewing = false
  }

  public startCuePreview(cueTime: number) {
    if (!this.buffer) return
    this.isCuePreviewing = true
    this.play(cueTime)
  }

  public stopCuePreview(cueTime: number) {
    this.isCuePreviewing = false
    this.stopSourceOnly()
    this.offset = cueTime
    this.isPlaying = false
  }

  private stopSourceOnly() {
    if (this.source) {
      try {
        this.source.stop()
        this.source.disconnect()
      } catch {
        // already stopped
      }
      this.source = null
    }
  }

  public seek(time: number) {
    if (!this.buffer) return
    const wasPlaying = this.isPlaying
    this.offset = Math.max(0, Math.min(this.buffer.duration, time))
    if (wasPlaying) {
      this.play(this.offset)
    } else {
      this.stopSourceOnly()
    }
  }

  public getCurrentTime(): number {
    if (!this.buffer) return 0
    if ((!this.isPlaying && !this.isCuePreviewing) || !this.source) return this.offset

    const elapsed = (this.ctx.currentTime - this.startContextTime) * this.currentPlaybackRate
    const current = this.offset + elapsed
    return Math.max(0, Math.min(this.buffer.duration, current))
  }

  public setPlaybackRate(rate: number) {
    const clampedRate = Math.max(0.05, Math.min(3.0, rate))
    if (Math.abs(this.currentPlaybackRate - clampedRate) < 0.0001) return

    if (this.isPlaying && this.source) {
      // Accumulate elapsed playback time before updating the rate,
      // guaranteeing seamless phase continuity without jumping the track time!
      this.offset = this.getCurrentTime()
      this.startContextTime = this.ctx.currentTime
      this.currentPlaybackRate = clampedRate

      if (!this.isScratching) {
        this.source.playbackRate.setTargetAtTime(
          this.currentPlaybackRate,
          this.ctx.currentTime,
          0.02
        )
      }
    } else {
      this.currentPlaybackRate = clampedRate
    }
  }

  public startScratch() {
    if (!this.buffer) return
    this.wasPlayingBeforeScratch = this.isPlaying
    this.isScratching = true

    if (this.isPlaying) {
      this.offset = this.getCurrentTime()
      this.stopSourceOnly()
    }
  }

  public scratch(deltaSec: number, velocity: number) {
    if (!this.buffer) return
    this.isScratching = true

    const newTime = Math.max(0, Math.min(this.buffer.duration, this.offset + deltaSec))
    this.offset = newTime

    this.playScratchGrain(newTime, velocity)
  }

  private playScratchGrain(time: number, velocity: number) {
    if (!this.buffer) return

    if (this.scratchGrainSource) {
      try {
        this.scratchGrainSource.stop()
        this.scratchGrainSource.disconnect()
      } catch {
        // ignore
      }
      this.scratchGrainSource = null
    }

    if (Math.abs(velocity) < 0.04) return

    const grain = this.ctx.createBufferSource()
    grain.buffer = this.buffer

    const absVel = Math.max(0.2, Math.min(2.5, Math.abs(velocity)))
    grain.playbackRate.value = absVel
    grain.connect(this.inputGain)

    const grainDuration = Math.max(0.04, Math.min(0.12, 0.06 * absVel))
    grain.start(0, Math.max(0, time))
    grain.stop(this.ctx.currentTime + grainDuration)

    this.scratchGrainSource = grain
  }

  public stopScratch() {
    this.isScratching = false

    if (this.scratchGrainSource) {
      try {
        this.scratchGrainSource.stop()
        this.scratchGrainSource.disconnect()
      } catch {
        // ignore
      }
      this.scratchGrainSource = null
    }

    if (this.wasPlayingBeforeScratch) {
      this.play(this.offset)
    } else {
      this.stopSourceOnly()
      this.isPlaying = false
    }
  }

  // EQ adjustments (-26dB to +6dB)
  public setEQ(eq: EQState) {
    const now = this.ctx.currentTime
    const lowGain = eq.lowKill ? -70 : eq.low
    const midGain = eq.midKill ? -70 : eq.mid
    const highGain = eq.highKill ? -70 : eq.high

    this.lowShelf.gain.setTargetAtTime(lowGain, now, 0.01)
    this.midPeak.gain.setTargetAtTime(midGain, now, 0.01)
    this.highShelf.gain.setTargetAtTime(highGain, now, 0.01)
  }

  // Sound Color Filter: -1.0 (LPF) to 0 (flat) to +1.0 (HPF)
  public setColorFilter(value: number) {
    const now = this.ctx.currentTime
    const clamped = Math.max(-1, Math.min(1, value))

    if (Math.abs(clamped) < 0.02) {
      this.colorFilter.type = 'allpass'
      this.colorFilter.frequency.setTargetAtTime(1000, now, 0.01)
      this.colorFilter.Q.setTargetAtTime(0.7, now, 0.01)
    } else if (clamped < 0) {
      this.colorFilter.type = 'lowpass'
      const norm = 1 + clamped
      const freq = 80 + Math.pow(norm, 2.8) * 19920
      this.colorFilter.frequency.setTargetAtTime(freq, now, 0.01)
      this.colorFilter.Q.setTargetAtTime(1.8, now, 0.01)
    } else {
      this.colorFilter.type = 'highpass'
      const freq = 20 + Math.pow(clamped, 2.5) * 8000
      this.colorFilter.frequency.setTargetAtTime(freq, now, 0.01)
      this.colorFilter.Q.setTargetAtTime(1.8, now, 0.01)
    }
  }

  public setTrim(trim: number) {
    this.trimGain.gain.setTargetAtTime(Math.max(0, trim), this.ctx.currentTime, 0.01)
  }

  public setVolume(vol: number) {
    const gain = Math.pow(Math.max(0, Math.min(1, vol)), 2)
    this.volumeGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.01)
  }

  public setCue(enabled: boolean) {
    this.cueSend.gain.setTargetAtTime(enabled ? 1.0 : 0.0, this.ctx.currentTime, 0.01)
  }

  // Post-Fader Effect Control with Spillover Echo Tail
  public setFX(fx: FXState, bpm: number) {
    this.connectFXToBus(fx.type)

    const now = this.ctx.currentTime

    if (!fx.enabled || fx.dryWet <= 0.01) {
      // Cut the input to the effect, allowing the active echo/reverb tail to spill over and ring out!
      this.fxSendGain.gain.setTargetAtTime(0.0, now, 0.02)
      // Fade out the return slowly after 4 seconds so tails never cut off abruptly
      this.fxReturnGain.gain.setTargetAtTime(0.0, now + 4.0, 1.0)
      return
    }

    // Effect is Active: Post-Fader Send & Return
    this.fxSendGain.gain.setTargetAtTime(1.0, now, 0.02)
    // Scale wet return: at 50% dryWet, return is at 1.0 (unity gain matching channel volume)
    const returnGain = Math.min(1.2, fx.dryWet * 2.0)
    this.fxReturnGain.gain.setTargetAtTime(returnGain, now, 0.02)

    switch (fx.type) {
      case 'echo': {
        const beatMultipliers = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0]
        const idx = Math.min(beatMultipliers.length - 1, Math.floor(fx.param * beatMultipliers.length))
        this.echoFX.setTime(beatMultipliers[idx], bpm)
        // Authentic console echo feedback (0.55 to 0.85) for luscious post-fader spillover
        this.echoFX.setFeedback(0.55 + fx.param * 0.3)
        break
      }
      case 'reverb': {
        this.reverbFX.setDecay(1.0 + fx.param * 3.5)
        break
      }
      case 'flanger': {
        this.flangerFX.setRate(0.1 + fx.param * 3.0)
        this.flangerFX.setFeedback(0.4 + fx.param * 0.4)
        break
      }
      case 'bitcrusher': {
        this.bitcrusherFX.setBits(fx.param)
        break
      }
    }
  }

  public getLevels(): { left: number; right: number } {
    const data = new Uint8Array(this.analyser.frequencyBinCount)
    this.analyser.getByteTimeDomainData(data)

    let sum = 0
    for (let i = 0; i < data.length; i++) {
      const val = (data[i] - 128) / 128
      sum += val * val
    }
    const rms = Math.sqrt(sum / data.length)
    const level = Math.min(1.0, rms * 3.5)

    return { left: level, right: level }
  }
}
