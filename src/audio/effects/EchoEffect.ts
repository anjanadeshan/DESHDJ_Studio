/**
 * Tempo-synced Delay / Echo Effect
 * Outputs wet delayed signal with feedback and tape damping filter
 */
export class EchoEffect {
  private ctx: AudioContext
  public input: GainNode
  public output: GainNode
  private delayNode: DelayNode
  private feedbackNode: GainNode
  private filterNode: BiquadFilterNode

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.input = ctx.createGain()
    this.output = ctx.createGain()

    this.delayNode = ctx.createDelay(2.5)
    this.delayNode.delayTime.value = 0.375 // default 3/8 note at 120bpm

    this.feedbackNode = ctx.createGain()
    this.feedbackNode.gain.value = 0.5

    this.filterNode = ctx.createBiquadFilter()
    this.filterNode.type = 'lowpass'
    this.filterNode.frequency.value = 3200 // classic analog tape damping

    // Wet signal feedback loop
    this.input.connect(this.delayNode)
    this.delayNode.connect(this.filterNode)
    this.filterNode.connect(this.feedbackNode)
    this.feedbackNode.connect(this.delayNode)

    this.filterNode.connect(this.output)
  }

  public setTime(beats: number, bpm: number) {
    const beatSec = 60 / Math.max(60, bpm)
    const time = Math.max(0.02, Math.min(2.0, beats * beatSec))
    this.delayNode.delayTime.setTargetAtTime(time, this.ctx.currentTime, 0.02)
  }

  public setFeedback(amount: number) {
    const clamped = Math.max(0.1, Math.min(0.85, amount))
    this.feedbackNode.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.02)
  }
}
