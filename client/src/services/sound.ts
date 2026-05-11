/**
 * SoundService — lightweight Web Audio API wrapper.
 * Falls back silently if audio is not supported.
 * Sound files should be placed in /public/sounds/ as .mp3 or .ogg.
 *
 * iOS rule: AudioContext must be CREATED inside a user-gesture call stack.
 * So we defer context creation to the first warmup() call (touchstart/click).
 * preload() just queues names; actual decoding happens after warmup().
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
  private pendingPreload: SoundName[] = [];

  private createContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private async _loadBuffers(ctx: AudioContext, names: SoundName[]): Promise<void> {
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

  /** Queue sound names for loading. Actual decode runs after first warmup(). */
  preload(names: SoundName[]): void {
    this.pendingPreload = [...names];
    // If context already exists (warmup already ran), decode immediately
    if (this.ctx) this._loadBuffers(this.ctx, names);
  }

  play(name: SoundName): void {
    if (!this.enabled) return;
    const buffer = this.cache.get(name);
    if (!buffer) return;
    const ctx = this.ctx; // never create context here — must come from warmup
    if (!ctx) return;

    const doPlay = () => {
      try {
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        gain.gain.value = this.volume;
        source.buffer = buffer;
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start();
      } catch { /* ignore */ }
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(doPlay).catch(() => {});
    } else {
      doPlay();
    }
  }

  /** Short beep to alert the player it's their turn. Also vibrates on Android. */
  playBeep(): void {
    try { navigator.vibrate?.(120); } catch { /* ignore */ }
    if (!this.enabled) return;
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => this._beepOsc(ctx)).catch(() => {});
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

  /**
   * Must be called from a user-gesture handler (touchstart / click / visibilitychange).
   * Creates the AudioContext for the first time (iOS requires this to happen inside
   * a gesture), loads any pending sound buffers, then resumes if suspended.
   */
  warmup(): void {
    // Create context inside user gesture — the ONLY way iOS unlocks audio
    const ctx = this.createContext();
    if (!ctx) return;

    // Decode pending sounds now that we have a valid context
    if (this.pendingPreload.length > 0) {
      const toLoad = this.pendingPreload;
      this.pendingPreload = [];
      this._loadBuffers(ctx, toLoad);
    }

    if (ctx.state !== 'suspended') return;

    // Resume + play a silent buffer to fully unlock iOS audio session
    ctx.resume().then(() => {
      try {
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
      } catch { /* ignore */ }
    }).catch(() => {});
  }

  setEnabled(v: boolean) { this.enabled = v; }
  setVolume(v: number) { this.volume = Math.max(0, Math.min(1, v)); }
  isEnabled() { return this.enabled; }
  getVolume() { return this.volume; }
}

export const soundService = new SoundService();
export type { SoundName };
