/**
 * Lightweight stamp sound via Web Audio (no asset file).
 */

export function playStampSound(enabled = true) {
  if (!enabled || typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;

  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;

    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = 'triangle';
    thud.frequency.setValueAtTime(220, now);
    thud.frequency.exponentialRampToValueAtTime(80, now + 0.09);
    thudGain.gain.setValueAtTime(0.0001, now);
    thudGain.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
    thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    thud.connect(thudGain);
    thudGain.connect(ctx.destination);
    thud.start(now);
    thud.stop(now + 0.15);

    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = 'square';
    click.frequency.setValueAtTime(640, now + 0.02);
    clickGain.gain.setValueAtTime(0.0001, now + 0.02);
    clickGain.gain.exponentialRampToValueAtTime(0.08, now + 0.03);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    click.connect(clickGain);
    clickGain.connect(ctx.destination);
    click.start(now + 0.02);
    click.stop(now + 0.08);

    window.setTimeout(() => {
      ctx.close?.();
    }, 200);
  } catch {
    /* audio optional */
  }
}
