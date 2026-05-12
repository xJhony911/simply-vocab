/**
 * Minimalist Sound Engine using Web Audio API
 * Provides soft, lo-fi style feedback sounds.
 */

class SoundEngine {
  private context: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    // Context is initialized on first user interaction to comply with browser policies
  }

  private initContext() {
    if (!this.context) {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  playFlip() {
    if (!this.enabled) return;
    this.initContext();
    this.playTone(220, 'sine', 0.1, 0.05); // Soft low note
  }

  playCorrect() {
    if (!this.enabled) return;
    this.initContext();
    this.playTone(440, 'triangle', 0.1, 0.15); // A4
    setTimeout(() => this.playTone(659.25, 'triangle', 0.1, 0.15), 100); // E5
  }

  playWrong() {
    if (!this.enabled) return;
    this.initContext();
    this.playTone(150, 'sawtooth', 0.2, 0.1, 0.05); // Low buzzy note
  }

  private playTone(freq: number, type: OscillatorType, volume: number, duration: number, rampDown: number = 0.05) {
    if (!this.context) return;
    
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.context.currentTime);
    
    gain.gain.setValueAtTime(volume, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(this.context.destination);
    
    osc.start();
    osc.stop(this.context.currentTime + duration + rampDown);
  }
}

export const sounds = new SoundEngine();
