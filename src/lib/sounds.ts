/**
 * Game Sound Engine - 100% synthesized with Web Audio API
 * No audio files needed. All sounds are generated programmatically.
 */

let audioCtx: AudioContext | null = null;
let isMuted = false;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  // Resume if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/** Play a note with envelope shaping */
function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.3,
  startTime = 0,
) {
  if (isMuted) return;
  const ctx = getCtx();
  const now = ctx.currentTime + startTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  osc.connect(gain);
  gain.connect(ctx.destination);

  // Attack
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  // Decay
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.start(now);
  osc.stop(now + duration + 0.01);
}

/** Play noise burst (percussion/cymbal) */
function playNoise(duration: number, volume = 0.15, startTime = 0) {
  if (isMuted) return;
  const ctx = getCtx();
  const now = ctx.currentTime + startTime;

  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  // Bandpass filter for more pleasant noise
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 8000;
  filter.Q.value = 0.5;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  source.start(now);
  source.stop(now + duration + 0.01);
}

// ========================================
// PUBLIC SOUND EFFECTS
// ========================================

/** Countdown tick - rising pitch as urgency increases */
export function playCountdownTick(secondsLeft: number) {
  if (isMuted) return;
  // Higher pitch as time runs out
  const baseFreq = 600 + (10 - Math.min(secondsLeft, 10)) * 80;
  playTone(baseFreq, 0.08, 'square', 0.15);
}

/** Critical countdown tick - last 3 seconds, double beep */
export function playCriticalTick() {
  if (isMuted) return;
  playTone(1200, 0.06, 'square', 0.2, 0);
  playTone(1400, 0.06, 'square', 0.2, 0.1);
}

/** Round start - ascending sweep + chord */
export function playRoundStart() {
  if (isMuted) return;
  // Quick ascending arpeggio: C5 -> E5 -> G5 -> C6
  playTone(523, 0.15, 'triangle', 0.25, 0);
  playTone(659, 0.15, 'triangle', 0.25, 0.1);
  playTone(784, 0.15, 'triangle', 0.25, 0.2);
  playTone(1047, 0.3, 'triangle', 0.3, 0.3);
  // Light cymbal
  playNoise(0.3, 0.08, 0.3);
}

/** Submit success - bright rising chime */
export function playSubmitSuccess() {
  if (isMuted) return;
  // Quick two-note chime: G5 -> C6
  playTone(784, 0.12, 'sine', 0.25, 0);
  playTone(1047, 0.25, 'sine', 0.3, 0.08);
  // Shimmer
  playTone(2093, 0.15, 'sine', 0.08, 0.1);
}

/** Score reveal - dramatic build + hit */
export function playScoreReveal() {
  if (isMuted) return;
  // Drum roll (fast noise bursts)
  for (let i = 0; i < 8; i++) {
    playNoise(0.06, 0.05 + i * 0.015, i * 0.06);
  }
  // Cymbal crash + chord at reveal
  playNoise(0.5, 0.15, 0.5);
  playTone(523, 0.4, 'triangle', 0.25, 0.5);   // C5
  playTone(659, 0.4, 'triangle', 0.2, 0.5);     // E5
  playTone(784, 0.4, 'triangle', 0.2, 0.5);     // G5
}

/** Good score celebration - major chord fanfare */
export function playGoodScore() {
  if (isMuted) return;
  // Bright fanfare: C major -> G major
  playTone(523, 0.2, 'triangle', 0.2, 0);    // C5
  playTone(659, 0.2, 'triangle', 0.15, 0);   // E5
  playTone(784, 0.2, 'triangle', 0.15, 0);   // G5
  // Second chord
  playTone(784, 0.3, 'triangle', 0.25, 0.2); // G5
  playTone(988, 0.3, 'triangle', 0.2, 0.2);  // B5
  playTone(1175, 0.3, 'triangle', 0.2, 0.2); // D6
  // Shimmer
  playNoise(0.2, 0.06, 0.2);
}

/** Bad score - descending minor */
export function playBadScore() {
  if (isMuted) return;
  playTone(440, 0.3, 'sawtooth', 0.12, 0);
  playTone(370, 0.4, 'sawtooth', 0.1, 0.2);
}

/** Leaderboard position reveal (per player row) */
export function playLeaderboardTick(index: number) {
  if (isMuted) return;
  const freq = 300 + index * 40;
  playTone(freq, 0.08, 'triangle', 0.12);
}

/** Podium celebration - epic fanfare */
export function playPodiumFanfare() {
  if (isMuted) return;
  // Dramatic orchestral hit
  playNoise(0.1, 0.12, 0);
  // C major chord
  playTone(262, 0.5, 'triangle', 0.2, 0.1);
  playTone(330, 0.5, 'triangle', 0.15, 0.1);
  playTone(392, 0.5, 'triangle', 0.15, 0.1);
  // Step up to F major
  playTone(349, 0.4, 'triangle', 0.2, 0.5);
  playTone(440, 0.4, 'triangle', 0.15, 0.5);
  playTone(523, 0.4, 'triangle', 0.15, 0.5);
  // Resolve to G major
  playTone(392, 0.4, 'triangle', 0.2, 0.9);
  playTone(494, 0.4, 'triangle', 0.15, 0.9);
  playTone(587, 0.4, 'triangle', 0.15, 0.9);
  // Final C major (octave up)
  playTone(523, 0.8, 'triangle', 0.25, 1.3);
  playTone(659, 0.8, 'triangle', 0.2, 1.3);
  playTone(784, 0.8, 'triangle', 0.2, 1.3);
  // Cymbal crash
  playNoise(0.8, 0.15, 1.3);
}

/** Player join sound - quick pop */
export function playPlayerJoin() {
  if (isMuted) return;
  playTone(880, 0.08, 'sine', 0.15, 0);
  playTone(1100, 0.12, 'sine', 0.2, 0.05);
}

/** Button click - subtle */
export function playClick() {
  if (isMuted) return;
  playTone(800, 0.04, 'square', 0.08);
}

// ========================================
// BACKGROUND MUSIC (Host only, Kahoot-style tension loop)
// ========================================

let musicIntervalId: ReturnType<typeof setInterval> | null = null;
let musicGainNode: GainNode | null = null;

/** Start a looping background music track. Call stopBackgroundMusic() to end. */
export function startBackgroundMusic() {
  if (isMuted || musicIntervalId) return;
  const ctx = getCtx();

  // Master gain for music
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.12, ctx.currentTime);
  masterGain.connect(ctx.destination);
  musicGainNode = masterGain;

  // ~140 BPM = beat every ~0.4286s. 4 bars of 4 beats = 16 beats per loop
  const BPM = 140;
  const beatDur = 60 / BPM; // ~0.4286s
  const loopDur = beatDur * 16; // ~6.857s per loop

  function scheduleLoop() {
    if (isMuted || !musicGainNode) return;
    const ctx = getCtx();
    const now = ctx.currentTime;

    // Bass line (triangle wave, low octave) — plays on beats 1,3,5,7... (half notes feel)
    const bassNotes = [131, 131, 147, 147, 165, 165, 147, 147]; // C3, D3, E3, D3 pattern
    bassNotes.forEach((freq, i) => {
      const t = now + i * beatDur * 2;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.connect(gain);
      gain.connect(musicGainNode!);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + beatDur * 1.8);
      osc.start(t);
      osc.stop(t + beatDur * 2);
    });

    // Arpeggio (square wave, mid octave) — 16th note feel on off-beats
    const arpNotes = [523, 659, 784, 659, 523, 587, 698, 587,
                      523, 659, 784, 1047, 784, 659, 523, 587]; // C5-E5-G5 arpeggio variants
    arpNotes.forEach((freq, i) => {
      const t = now + i * beatDur;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);
      osc.connect(gain);
      gain.connect(musicGainNode!);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.15, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + beatDur * 0.7);
      osc.start(t);
      osc.stop(t + beatDur);
    });

    // Hi-hat style ticks (noise) on every beat
    for (let i = 0; i < 16; i++) {
      const t = now + i * beatDur;
      const bufferSize = Math.floor(ctx.sampleRate * 0.03);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let j = 0; j < bufferSize; j++) {
        data[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / bufferSize, 3);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(i % 4 === 0 ? 0.18 : 0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 8000;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(musicGainNode!);
      source.start(t);
      source.stop(t + 0.05);
    }
  }

  // Schedule first loop immediately, then repeat
  scheduleLoop();
  musicIntervalId = setInterval(scheduleLoop, loopDur * 1000);
}

/** Stop background music */
export function stopBackgroundMusic() {
  if (musicIntervalId) {
    clearInterval(musicIntervalId);
    musicIntervalId = null;
  }
  if (musicGainNode) {
    try {
      const ctx = getCtx();
      musicGainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      setTimeout(() => {
        musicGainNode?.disconnect();
        musicGainNode = null;
      }, 400);
    } catch {
      musicGainNode = null;
    }
  }
}

// ========================================
// MUTE CONTROLS
// ========================================

export function toggleMute(): boolean {
  isMuted = !isMuted;
  return isMuted;
}

export function getMuted(): boolean {
  return isMuted;
}

export function setMuted(muted: boolean) {
  isMuted = muted;
}

/**
 * Initialize audio context on first user interaction.
 * Must be called from a click/touch handler due to browser autoplay policy.
 */
export function initAudio() {
  getCtx();
}
