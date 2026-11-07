import React, { useEffect, useRef, useState } from 'react';

interface ConfettiOverlayProps {
  active: boolean;
}

const COLORS = ['#F59E0B', '#06B6D4', '#10B981', '#FBBF24', '#38BDF8'];

export const ConfettiOverlay: React.FC<ConfettiOverlayProps> = ({ active }) => {
  const [visible, setVisible] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const hideTimer = window.setTimeout(() => {
      setVisible(false);
    }, 3200);
    return () => window.clearTimeout(hideTimer);
  }, [active]);

  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = (canvas.width = window.innerWidth);
    const height = (canvas.height = window.innerHeight);

    const particles = Array.from({ length: 45 }, (_, i) => ({
      x: ((i * 37) % 100) * (width / 100),
      y: -10 - (i % 8) * 18,
      vx: (i % 2 === 0 ? 1 : -1) * (0.8 + (i % 4) * 0.4),
      vy: 3.5 + (i % 5) * 1.1,
      size: 7 + (i % 4) * 2.5,
      color: COLORS[i % COLORS.length],
      angle: (i * 0.5) % Math.PI,
      vAngle: (i % 2 === 0 ? 1 : -1) * 0.06,
    }));

    let rafId = 0;
    let timerId = 0;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.vAngle;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.65);
        ctx.restore();
      }
      timerId = window.setTimeout(() => {
        rafId = window.requestAnimationFrame(draw);
      }, 32);
    };

    draw();

    return () => {
      if (timerId) window.clearTimeout(timerId);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="confetti-overlay"
      className="fixed inset-0 pointer-events-none z-50 no-print"
    />
  );
};
