/**
 * Bitcrusher & Distortion Effect using WaveShaper quantization curve
 * Outputs wet crushed distortion signal
 */
export class BitcrusherEffect {
  private ctx: AudioContext
  public input: GainNode
  public output: GainNode
  private waveShaper: WaveShaperNode
  private preGain: GainNode
  private postFilter: BiquadFilterNode

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.input = ctx.createGain()
    this.output = ctx.createGain()

    this.preGain = ctx.createGain()
    this.preGain.gain.value = 1.6

    this.waveShaper = ctx.createWaveShaper()
    this.waveShaper.oversample = 'none'
    this.updateCurve(8)

    this.postFilter = ctx.createBiquadFilter()
    this.postFilter.type = 'lowpass'
    this.postFilter.frequency.value = 6000

    this.input.connect(this.preGain)
    this.preGain.connect(this.waveShaper)
    this.waveShaper.connect(this.postFilter)
    this.postFilter.connect(this.output)
  }

  private updateCurve(bits: number) {
    const steps = Math.pow(2, Math.max(2, Math.min(16, bits)))
    const samples = 4096
    const curve = new Float32Array(samples)

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1
      curve[i] = Math.round(x * steps) / steps
    }
    this.waveShaper.curve = curve
  }

  public setBits(param: number) {
    const bits = 3 + Math.round((1 - param) * 7)
    this.updateCurve(bits)
    this.postFilter.frequency.setTargetAtTime(2000 + param * 7000, this.ctx.currentTime, 0.02)
  }
}
