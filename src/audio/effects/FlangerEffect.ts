/**
 * Stereo Flanger / Jet Sweep Effect
 * Outputs wet comb-filter modulated signal
 */
export class FlangerEffect {
  private ctx: AudioContext
  public input: GainNode
  public output: GainNode
  private delayNode: DelayNode
  private feedbackNode: GainNode
  private lfo: OscillatorNode
  private lfoGain: GainNode

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.input = ctx.createGain()
    this.output = ctx.createGain()

    this.delayNode = ctx.createDelay(0.02)
    this.delayNode.delayTime.value = 0.003

    this.feedbackNode = ctx.createGain()
    this.feedbackNode.gain.value = 0.65

    this.lfo = ctx.createOscillator()
    this.lfo.type = 'sine'
    this.lfo.frequency.value = 0.35

    this.lfoGain = ctx.createGain()
    this.lfoGain.gain.value = 0.002

    this.lfo.connect(this.lfoGain)
    this.lfoGain.connect(this.delayNode.delayTime)
    this.lfo.start()

    // Wet & Feedback
    this.input.connect(this.delayNode)
    this.delayNode.connect(this.feedbackNode)
    this.feedbackNode.connect(this.delayNode)

    this.delayNode.connect(this.output)
  }

  public setRate(rateHz: number) {
    const clamped = Math.max(0.1, Math.min(4.0, rateHz))
    this.lfo.frequency.setTargetAtTime(clamped, this.ctx.currentTime, 0.03)
  }

  public setFeedback(amount: number) {
    const clamped = Math.max(0, Math.min(0.85, amount))
    this.feedbackNode.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.02)
  }
}
