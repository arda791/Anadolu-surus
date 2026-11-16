// 100% Procedural Web Audio API synthesizer for Turkish driving simulator

export class DrivingAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private tireNoiseGain: GainNode | null = null;
  private signalTimer = 0;
  private signalClickHigh = true;
  private muted = false;
  private isElectric = false;

  public init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.35;
    master.connect(ctx.destination);
    this.masterGain = master;

    // Continuous Engine Dual-Oscillator Synth
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    filter.Q.value = 2.4;

    const engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 55;

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = 110;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);

    osc1.start();
    osc2.start();

    this.engineOsc1 = osc1;
    this.engineOsc2 = osc2;
    this.engineFilter = filter;
    this.engineGain = engineGain;

    // Tire Screech / Road Noise (filtered white noise)
    const bufferSize = ctx.sampleRate * 1.5;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;
    noiseSrc.loop = true;

    const tireBand = ctx.createBiquadFilter();
    tireBand.type = 'bandpass';
    tireBand.frequency.value = 1150;
    tireBand.Q.value = 4.5;

    const tireGain = ctx.createGain();
    tireGain.gain.value = 0;

    noiseSrc.connect(tireBand);
    tireBand.connect(tireGain);
    tireGain.connect(master);
    noiseSrc.start();
    this.tireNoiseGain = tireGain;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        muted ? 0 : 0.35,
        this.ctx.currentTime,
        0.04,
      );
    }
  }

  public setElectricMode(isElectric: boolean): void {
    this.isElectric = isElectric;
    if (this.engineOsc1 && this.engineOsc2) {
      this.engineOsc1.type = isElectric ? 'sine' : 'sawtooth';
      this.engineOsc2.type = isElectric ? 'triangle' : 'triangle';
    }
  }

  public silence(): void {
    if (!this.ctx || !this.engineGain || !this.tireNoiseGain) return;
    const now = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(0, now, 0.05);
    this.tireNoiseGain.gain.setTargetAtTime(0, now, 0.05);
  }

  public update(
    rpm: number,
    speedMs: number,
    throttle: boolean,
    slipAmount: number,
    signalActive: boolean,
    dt: number,
    playing: boolean,
  ): void {
    if (!this.ctx || !this.engineGain || !this.engineOsc1 || !this.engineOsc2 || !this.engineFilter) {
      return;
    }

    if (!playing || this.muted) {
      this.silence();
      return;
    }

    const now = this.ctx.currentTime;

    if (this.isElectric) {
      // Subtle futuristic EV inverter tone
      const freq = 95 + (Math.abs(speedMs) * 3.6) * 2.1;
      this.engineOsc1.frequency.setTargetAtTime(freq, now, 0.04);
      this.engineOsc2.frequency.setTargetAtTime(freq * 2.02, now, 0.04);
      this.engineFilter.frequency.setTargetAtTime(700 + Math.abs(speedMs) * 25, now, 0.05);
      const gain = 0.035 + (throttle ? 0.055 : 0.015) * Math.min(1, Math.abs(speedMs) / 18);
      this.engineGain.gain.setTargetAtTime(gain, now, 0.05);
    } else {
      const baseFreq = 32 + (rpm / 7000) * 145;
      this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.04);
      this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.5, now, 0.04);
      const cutoff = 180 + (rpm / 7000) * (throttle ? 1200 : 520);
      this.engineFilter.frequency.setTargetAtTime(cutoff, now, 0.05);
      const gain = throttle ? 0.16 : 0.075;
      this.engineGain.gain.setTargetAtTime(gain, now, 0.06);
    }

    if (this.tireNoiseGain) {
      const screech = Math.max(0, Math.min(0.16, (slipAmount - 0.35) * 0.25));
      this.tireNoiseGain.gain.setTargetAtTime(screech, now, 0.04);
    }

    if (signalActive) {
      this.signalTimer += dt;
      if (this.signalTimer >= 0.42) {
        this.signalTimer = 0;
        this.playSignalClick(this.signalClickHigh);
        this.signalClickHigh = !this.signalClickHigh;
      }
    } else {
      this.signalTimer = 0.35;
    }
  }

  private playSignalClick(high: boolean): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(high ? 880 : 620, now);
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  public playHorn(): void {
    this.init();
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    // Classic Turkish dual-tone Fiamm-style car horn (400 Hz + 500 Hz)
    for (const freq of [400, 500]) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      filter.type = 'bandpass';
      filter.frequency.value = 1100;
      filter.Q.value = 1.2;
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.14, now + 0.02);
      g.gain.setValueAtTime(0.14, now + 0.22);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      osc.connect(filter);
      filter.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.34);
    }
  }

  public playNearMiss(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(860, now + 0.14);
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playCollision(severity: number): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.24);
    g.gain.setValueAtTime(0.28 * Math.max(0.3, severity), now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
