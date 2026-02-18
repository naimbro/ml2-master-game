/**
 * Confetti effects using canvas-confetti (3KB library)
 * Provides celebration particle effects for the game.
 */
import confetti from 'canvas-confetti';

// Kahoot-inspired colors
const KAHOOT_COLORS = ['#FF3355', '#45A3E5', '#66BF39', '#EB670F', '#FFC107', '#46178F'];

/** Small burst for good score (score >= 80) */
export function confettiBurst() {
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.65 },
    colors: KAHOOT_COLORS,
    ticks: 200,
    gravity: 1.2,
    scalar: 1.1,
  });
}

/** Side cannons for excellent score (score >= 90) */
export function confettiCannons() {
  const end = Date.now() + 800;

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.65 },
      colors: KAHOOT_COLORS,
      ticks: 200,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.65 },
      colors: KAHOOT_COLORS,
      ticks: 200,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };
  frame();
}

/** Epic podium celebration - multi-wave */
export function confettiPodium() {
  const duration = 3000;
  const end = Date.now() + duration;

  const frame = () => {
    const timeLeft = end - Date.now();

    // Firework bursts
    confetti({
      particleCount: 5,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: KAHOOT_COLORS,
      ticks: 300,
      gravity: 0.8,
    });
    confetti({
      particleCount: 5,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: KAHOOT_COLORS,
      ticks: 300,
      gravity: 0.8,
    });

    // Random center bursts
    if (Math.random() < 0.3) {
      confetti({
        particleCount: 15,
        spread: 360,
        origin: { x: Math.random() * 0.6 + 0.2, y: Math.random() * 0.3 + 0.2 },
        colors: KAHOOT_COLORS,
        ticks: 250,
        scalar: 1.3,
        shapes: ['circle', 'square'],
        gravity: 0.6,
      });
    }

    if (timeLeft > 0) {
      requestAnimationFrame(frame);
    }
  };
  frame();
}

/** Stars burst (for rank reveal) */
export function confettiStars() {
  confetti({
    particleCount: 40,
    spread: 90,
    origin: { y: 0.5 },
    colors: ['#FFC107', '#FFD700', '#FFEB3B'],
    shapes: ['circle'],
    ticks: 150,
    gravity: 0.6,
    scalar: 1.5,
  });
}

/** Submit flash - small celebratory pop */
export function confettiPop() {
  confetti({
    particleCount: 30,
    spread: 50,
    origin: { y: 0.75 },
    colors: ['#66BF39', '#45A3E5', '#FFC107'],
    ticks: 100,
    gravity: 1.5,
    scalar: 0.8,
  });
}
