/**
 * Algorithmic Stereo Room / Hall Reverb using synthesized impulse response
 * Outputs wet reverb space signal
 */
export class ReverbEffect {
  private ctx: AudioContext
  public input: GainNode
  public output: GainNode
  private convolver: ConvolverNode

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.input = ctx.createGain()
    this.output = ctx.createGain()

    this.convolver = ctx.createConvolver()
    this.convolver.buffer = this.buildImpulse(2.2, 2.0)

    this.input.connect(this.convolver)
    this.convolver.connect(this.output)
  }

  private buildImpulse(duration: number, decay: number): AudioBuffer {
    const rate = this.ctx.sampleRate
    const length = Math.floor(rate * duration)
    const impulse = this.ctx.createBuffer(2, length, rate)
    const left = impulse.getChannelData(0)
    const right = impulse.getChannelData(1)

    for (let i = 0; i < length; i++) {
      const n = i / length
      const envelope = Math.pow(1 - n, decay)
      left[i] = (Math.random() * 2 - 1) * envelope
      right[i] = (Math.random() * 2 - 1) * envelope
    }
    return impulse
  }

  public setDecay(durationSeconds: number) {
    const dur = Math.max(0.5, Math.min(4.0, durationSeconds))
    this.convolver.buffer = this.buildImpulse(dur, 2.2)
  }
}
