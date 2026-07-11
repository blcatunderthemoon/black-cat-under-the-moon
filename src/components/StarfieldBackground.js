/**
 * StarfieldBackground — animated pixel stars behind app pages.
 * Ported from public/index.html starfield script.
 */

import { useEffect, useRef } from 'react';

export default function StarfieldBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    let animId = 0;
    const stars = [];

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 42; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() < 0.15 ? 2 : 1,
        speed: Math.random() * 0.06 + 0.02,
        phase: Math.random() * Math.PI * 2,
        twinkle: Math.random() * 0.001 + 0.0004,
      });
    }

    function draw(time) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const colors = ['255,255,255', '200,180,255', '180,230,255', '255,220,180'];
      const t = time * 0.001;
      stars.forEach((s) => {
        s.y += s.speed;
        if (s.y > canvas.height + 2) {
          s.y = -2;
          s.x = Math.random() * canvas.width;
        }
        const alpha = 0.3 + 0.18 * Math.sin(t * s.twinkle * 1000 + s.phase);
        const c = colors[(s.size + Math.floor(s.x)) % colors.length];
        ctx.fillStyle = `rgba(${c},${alpha.toFixed(2)})`;
        ctx.fillRect(Math.floor(s.x), Math.floor(s.y), s.size, s.size);
      });
      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="starfield-canvas" aria-hidden="true" />;
}
