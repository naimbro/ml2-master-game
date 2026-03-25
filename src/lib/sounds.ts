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
// BACKGROUND MUSIC — Multiple styles
// ========================================

export type MusicStyle = 'kahoot' | 'chill' | 'retro' | 'ambient';

export const MUSIC_OPTIONS: { id: MusicStyle; name: string }[] = [
  { id: 'kahoot', name: 'Kahoot Energy' },
  { id: 'chill', name: 'Lo-fi Focus' },
  { id: 'retro', name: 'Retro Arcade' },
  { id: 'ambient', name: 'Tension Ambiental' },
];

let musicIntervalId: ReturnType<typeof setInterval> | null = null;
let musicGainNode: GainNode | null = null;
let currentMusicStyle: MusicStyle = 'kahoot';

export function getCurrentMusicStyle(): MusicStyle {
  return currentMusicStyle;
}

export function switchMusic(style: MusicStyle) {
  currentMusicStyle = style;
  // Always hard-stop then restart — even if music died (musicIntervalId is null)
  stopBackgroundMusicImmediate();
  startBackgroundMusic(style);
}

/** Hard stop with no fade — prevents race condition where a delayed disconnect kills the new gain node */
function stopBackgroundMusicImmediate() {
  if (musicIntervalId) {
    clearInterval(musicIntervalId);
    musicIntervalId = null;
  }
  if (musicGainNode) {
    try {
      musicGainNode.disconnect();
    } catch { /* already disconnected */ }
    musicGainNode = null;
  }
}

// --- Kahoot (original) ---
function scheduleKahoot(masterGain: GainNode) {
  const BPM = 140;
  const beatDur = 60 / BPM;
  const loopDur = beatDur * 16;

  function scheduleLoop() {
    if (isMuted || !musicGainNode) return;
    const ctx = getCtx();
    const now = ctx.currentTime;

    const bassNotes = [131, 131, 147, 147, 165, 165, 147, 147];
    bassNotes.forEach((freq, i) => {
      const t = now + i * beatDur * 2;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.connect(gain);
      gain.connect(masterGain);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + beatDur * 1.8);
      osc.start(t);
      osc.stop(t + beatDur * 2);
    });

    const arpNotes = [523, 659, 784, 659, 523, 587, 698, 587,
                      523, 659, 784, 1047, 784, 659, 523, 587];
    arpNotes.forEach((freq, i) => {
      const t = now + i * beatDur;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);
      osc.connect(gain);
      gain.connect(masterGain);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.15, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + beatDur * 0.7);
      osc.start(t);
      osc.stop(t + beatDur);
    });

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
      gain.connect(masterGain);
      source.start(t);
      source.stop(t + 0.05);
    }
  }

  scheduleLoop();
  musicIntervalId = setInterval(scheduleLoop, loopDur * 1000);
}

// --- Lo-fi Focus (chill) ---
function scheduleChill(masterGain: GainNode) {
  const BPM = 85;
  const beatDur = 60 / BPM;
  const loopDur = beatDur * 16;

  // Jazzy minor 7th chords: Dm7 → G7 → Cmaj7 → Am7
  const chords = [
    [294, 349, 440, 523],  // Dm7: D4 F4 A4 C5
    [392, 494, 587, 698],  // G7: G4 B4 D5 F5
    [330, 392, 494, 587],  // Cmaj7: E4 G4 B4 D5
    [440, 523, 659, 784],  // Am7: A4 C5 E5 G5
  ];

  function scheduleLoop() {
    if (isMuted || !musicGainNode) return;
    const ctx = getCtx();
    const now = ctx.currentTime;

    // Pad chords — each chord lasts 4 beats
    chords.forEach((chord, ci) => {
      const chordStart = now + ci * beatDur * 4;
      chord.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, chordStart);
        osc.connect(gain);
        gain.connect(masterGain);
        gain.gain.setValueAtTime(0.001, chordStart);
        gain.gain.linearRampToValueAtTime(0.12, chordStart + beatDur);
        gain.gain.linearRampToValueAtTime(0.08, chordStart + beatDur * 3);
        gain.gain.linearRampToValueAtTime(0.001, chordStart + beatDur * 4);
        osc.start(chordStart);
        osc.stop(chordStart + beatDur * 4 + 0.1);
      });
    });

    // Soft bass — root notes, triangle wave
    const bassRoots = [147, 196, 131, 220]; // D3 G3 C3 A3
    bassRoots.forEach((freq, i) => {
      const t = now + i * beatDur * 4;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.connect(gain);
      gain.connect(masterGain);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.3, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + beatDur * 3.5);
      osc.start(t);
      osc.stop(t + beatDur * 4);
    });
  }

  scheduleLoop();
  musicIntervalId = setInterval(scheduleLoop, loopDur * 1000);
}

// --- Retro Arcade ---
function scheduleRetro(masterGain: GainNode) {
  const BPM = 120;
  const beatDur = 60 / BPM;
  const loopDur = beatDur * 16;

  function scheduleLoop() {
    if (isMuted || !musicGainNode) return;
    const ctx = getCtx();
    const now = ctx.currentTime;

    // 8-bit arpeggio (sawtooth lead) — fast 16th notes
    const arpNotes = [
      523, 659, 784, 1047, 880, 784, 659, 523,
      587, 698, 880, 1047, 880, 698, 587, 440,
    ];
    arpNotes.forEach((freq, i) => {
      const t = now + i * beatDur;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      osc.connect(gain);
      gain.connect(masterGain);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.1, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + beatDur * 0.6);
      osc.start(t);
      osc.stop(t + beatDur);
    });

    // Square bass — half notes
    const bassNotes = [131, 131, 147, 110, 131, 131, 147, 110];
    bassNotes.forEach((freq, i) => {
      const t = now + i * beatDur * 2;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);
      osc.connect(gain);
      gain.connect(masterGain);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + beatDur * 1.5);
      osc.start(t);
      osc.stop(t + beatDur * 2);
    });

    // Kick-style pulse on beats 1,5,9,13
    for (let i = 0; i < 4; i++) {
      const t = now + i * beatDur * 4;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
      osc.connect(gain);
      gain.connect(masterGain);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.start(t);
      osc.stop(t + 0.2);
    }
  }

  scheduleLoop();
  musicIntervalId = setInterval(scheduleLoop, loopDur * 1000);
}

// --- Tension Ambiental ---
function scheduleAmbient(masterGain: GainNode) {
  const loopDur = 8; // 8 seconds per cycle

  function scheduleLoop() {
    if (isMuted || !musicGainNode) return;
    const ctx = getCtx();
    const now = ctx.currentTime;

    // Slowly evolving sine pads — two detuned oscillators per voice
    const padFreqs = [220, 277, 330]; // A3 C#4 E4 (A major triad, dreamy)
    padFreqs.forEach((freq, i) => {
      const startOffset = i * 1.5;
      // Main oscillator
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(freq, now + startOffset);
      osc2.frequency.setValueAtTime(freq * 1.003, now + startOffset); // slight detune
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(masterGain);
      gain.gain.setValueAtTime(0.001, now + startOffset);
      gain.gain.linearRampToValueAtTime(0.1, now + startOffset + 2);
      gain.gain.linearRampToValueAtTime(0.06, now + startOffset + 5);
      gain.gain.linearRampToValueAtTime(0.001, now + startOffset + 7.5);
      osc1.start(now + startOffset);
      osc2.start(now + startOffset);
      osc1.stop(now + startOffset + 8);
      osc2.stop(now + startOffset + 8);
    });

    // Subtle high shimmer — filtered noise
    const bufferSize = Math.floor(ctx.sampleRate * 4);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let j = 0; j < bufferSize; j++) {
      data[j] = (Math.random() * 2 - 1);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.linearRampToValueAtTime(0.015, now + 2);
    noiseGain.gain.linearRampToValueAtTime(0.01, now + 6);
    noiseGain.gain.linearRampToValueAtTime(0.001, now + 7.8);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    filter.Q.value = 2;
    source.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(masterGain);
    source.start(now);
    source.stop(now + 8);
  }

  scheduleLoop();
  musicIntervalId = setInterval(scheduleLoop, loopDur * 1000);
}

/** Start a looping background music track. Call stopBackgroundMusic() to end. */
export function startBackgroundMusic(style: MusicStyle = 'kahoot') {
  if (isMuted || musicIntervalId) return;
  currentMusicStyle = style;
  const ctx = getCtx();

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.12, ctx.currentTime);
  masterGain.connect(ctx.destination);
  musicGainNode = masterGain;

  switch (style) {
    case 'kahoot': scheduleKahoot(masterGain); break;
    case 'chill': scheduleChill(masterGain); break;
    case 'retro': scheduleRetro(masterGain); break;
    case 'ambient': scheduleAmbient(masterGain); break;
  }
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
// PODIUM REVEAL SOUNDS
// ========================================

/** Drum roll — filtered noise with crescendo envelope for suspense */
export function playDrumRoll() {
  if (isMuted) return;
  const ctx = getCtx();
  const now = ctx.currentTime;
  const duration = 1.5;

  // Create noise buffer
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  // Bandpass filter to sound like snare roll
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1200;
  filter.Q.value = 0.8;

  // Crescendo envelope
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.02, now);
  gain.gain.linearRampToValueAtTime(0.18, now + duration * 0.85);
  gain.gain.linearRampToValueAtTime(0.001, now + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  source.start(now);
  source.stop(now + duration + 0.01);
}

/** Applause — filtered noise bursts simulating crowd. Intensity 1-3 controls duration and volume. */
export function playApplause(intensity: 1 | 2 | 3 = 2) {
  if (isMuted) return;
  const ctx = getCtx();
  const now = ctx.currentTime;
  const durations = { 1: 0.8, 2: 1.2, 3: 2.0 };
  const volumes = { 1: 0.08, 2: 0.12, 3: 0.18 };
  const duration = durations[intensity];
  const volume = volumes[intensity];

  // Create noise buffer
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Modulate noise to sound like clapping (irregular amplitude)
  for (let i = 0; i < bufferSize; i++) {
    const t = i / ctx.sampleRate;
    const modulation = 0.5 + 0.5 * Math.sin(t * 25) * Math.sin(t * 37);
    data[i] = (Math.random() * 2 - 1) * modulation;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  // Bandpass to simulate crowd frequency range
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2500;
  filter.Q.value = 0.4;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.1);
  gain.gain.setValueAtTime(volume, now + duration * 0.6);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  source.start(now);
  source.stop(now + duration + 0.01);
}

// ========================================
// LEADERBOARD REVEAL SOUNDS
// ========================================

/** Rising tension sweep — dissonant interval that builds suspense */
export function playTensionSweep() {
  if (isMuted) return;
  const ctx = getCtx();
  const now = ctx.currentTime;
  const duration = 1.8;

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'sine';
  osc2.type = 'sine';
  // Start at tritone (dissonant), sweep up
  osc1.frequency.setValueAtTime(300, now);
  osc1.frequency.exponentialRampToValueAtTime(600, now + duration);
  osc2.frequency.setValueAtTime(424, now);
  osc2.frequency.exponentialRampToValueAtTime(900, now + duration);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + duration * 0.85);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + duration + 0.01);
  osc2.stop(now + duration + 0.01);
}

/** Position-specific reveal sound — increasingly dramatic for top ranks */
export function playRankReveal(rank: number, totalPlayers: number) {
  if (isMuted) return;
  if (rank <= 3) {
    // Podium positions get ascending chord
    const chords: Record<number, number[]> = {
      3: [440, 554, 659],      // A major
      2: [494, 622, 740],      // B major
      1: [523, 659, 784, 1047], // C major + octave
    };
    const notes = chords[rank] || chords[3];
    notes.forEach((freq, i) => {
      playTone(freq, 0.5, 'triangle', 0.15 - i * 0.02, i * 0.06);
    });
    if (rank === 1) {
      playNoise(0.6, 0.12, 0.2); // cymbal crash for #1
    } else {
      playNoise(0.2, 0.06, 0.1);
    }
  } else {
    // Non-podium: rising pitch tick
    const freq = 300 + (totalPlayers - rank) * 60;
    playTone(freq, 0.12, 'triangle', 0.12);
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
