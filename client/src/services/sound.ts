/**
 * SoundService — lightweight Web Audio API wrapper.
 * Falls back silently if audio is not supported.
 * Sound files should be placed in /public/sounds/ as .mp3 or .ogg.
 */

type SoundName =
  | 'card_deal'
  | 'card_draw'
  | 'card_discard'
  | 'card_flip'
  | 'power_seven'
  | 'power_jack'
  | 'show_call'
  | 'win'
  | 'lose'
  | 'tick'
  | 'chat'
  | 'join';

const SOUND_FILES: Record<SoundName, string> = {
  card_deal: '/sounds/card_deal.mp3',
  card_draw: '/sounds/card_draw.mp3',
  card_discard: '/sounds/card_discard.mp3',
  card_flip: '/sounds/card_flip.mp3',
  power_seven: '/sounds/power_seven.mp3',
  power_jack: '/sounds/power_jack.mp3',
  show_call: '/sounds/show_call.mp3',
  win: '/sounds/win.mp3',
  lose: '/sounds/lose.mp3',
  tick: '/sounds/tick.mp3',
  chat: '/sounds/chat.mp3',
  join: '/sounds/join.mp3',
};

class SoundService {
  private cache = new Map<string, AudioBuffer>();
  private ctx: AudioContext | null = null;
  private enabled = true;
  private volume = 0.7;

  private getContext(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch {
        return null;
      }
    }
    return this.ctx;
  }

  async preload(names: SoundName[]): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;

    await Promise.allSettled(
      names.map(async (name) => {
        if (this.cache.has(name)) return;
        try {
          const res = await fetch(SOUND_FILES[name]);
          const buf = await res.arrayBuffer();
          const decoded = await ctx.decodeAudioData(buf);
          this.cache.set(name, decoded);
        } catch { /* sound file missing — fail silently */ }
      })
    );
  }

  play(name: SoundName): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    // Resume suspended context (required after user gesture)
    if (ctx.state === 'suspended') ctx.resume();

    const buffer = this.cache.get(name);
    if (!buffer) return;

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = this.volume;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }

  /** Short beep to alert the player that it's their turn. Uses oscillator — no file needed.
   *  Also vibrates on Android. iOS requires warmup() called from a prior user gesture. */
  playBeep(): void {
    // Vibrate on Android (ignored on iOS/desktop)
    try { navigator.vibrate?.(120); } catch { /* ignore */ }

    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => this._beepOsc(ctx));
      return;
    }
    this._beepOsc(ctx);
  }

  private _beepOsc(ctx: AudioContext): void {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(this.volume * 0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch { /* ignore if context closed */ }
  }

  /** Call this from any user-gesture handler to pre-warm the AudioContext on iOS.
   *  Safe to call repeatedly — only does work when context is suspended. */
  warmup(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    if (ctx.state !== 'suspended') return;
    ctx.resume().catch(() => {});
    // Play a silent buffer — forces iOS to fully unlock the audio context
    try {
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    } catch { /* ignore */ }
  }

  setEnabled(v: boolean) { this.enabled = v; }
  setVolume(v: number) { this.volume = Math.max(0, Math.min(1, v)); }
  isEnabled() { return this.enabled; }
  getVolume() { return this.volume; }
}

export const soundService = new SoundService();
export type { SoundName };
