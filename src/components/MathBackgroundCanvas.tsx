import React, { useEffect, useRef } from 'react';

interface MathBackgroundCanvasProps {
  isDark: boolean;
}

interface FloatingSymbol {
  x: number;
  y: number;
  vx: number;
  vy: number;
  text: string;
  size: number;
  alpha: number;
  isGold: boolean;
  rotation: number;
  vRot: number;
  shapeType: 'text' | 'triangle' | 'circle';
}

const MATH_SYMBOLS = [
  'π',
  '∑',
  '∫',
  '√x',
  '∞',
  'sin(θ)',
  'cos(θ)',
  'Δ',
  'a² + b² = c²',
  'f(x)',
  '∂y/∂x',
  'θ',
  'λ',
  'lim x→∞',
];

export const MathBackgroundCanvas: React.FC<MathBackgroundCanvasProps> = ({ isDark }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDarkRef = useRef(isDark);

  useEffect(() => {
    isDarkRef.current = isDark;
  }, [isDark]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId = 0;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Initialize deterministic-feeling floating math items
    const itemCount = Math.min(24, Math.max(14, Math.floor(width / 65)));
    const items: FloatingSymbol[] = Array.from({ length: itemCount }, (_, i) => {
      const shapeRoll = i % 6;
      const shapeType: FloatingSymbol['shapeType'] =
        shapeRoll === 0 ? 'triangle' : shapeRoll === 3 ? 'circle' : 'text';
      return {
        x: ((i * 173) % Math.max(width, 300)) + 20,
        y: ((i * 257) % Math.max(height, 300)) + 20,
        vx: ((i % 2 === 0 ? 1 : -1) * (0.12 + (i % 5) * 0.04)),
        vy: -0.15 - (i % 4) * 0.05,
        text: MATH_SYMBOLS[i % MATH_SYMBOLS.length],
        size: shapeType === 'text' ? 14 + (i % 4) * 4 : 22 + (i % 3) * 6,
        alpha: 0.14 + (i % 4) * 0.05,
        isGold: i % 3 === 0,
        rotation: (i * 0.4) % (Math.PI * 2),
        vRot: (i % 2 === 0 ? 1 : -1) * 0.002,
        shapeType,
      };
    });

    let phase = 0;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const render = () => {
      const dark = isDarkRef.current;
      ctx.clearRect(0, 0, width, height);

      // 1. Coordinate Grid
      const gridSize = 64;
      const offsetX = (phase * 8) % gridSize;
      const offsetY = (phase * 5) % gridSize;

      ctx.lineWidth = 1;
      ctx.strokeStyle = dark ? 'rgba(56, 189, 248, 0.055)' : 'rgba(15, 23, 42, 0.045)';

      ctx.beginPath();
      for (let x = -gridSize + offsetX; x < width + gridSize; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = -gridSize + offsetY; y < height + gridSize; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // 2. Subtle Sine & Cosine Wave Curves
      const waveYCenter = height * 0.68;
      ctx.beginPath();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = dark ? 'rgba(6, 182, 212, 0.14)' : 'rgba(2, 132, 199, 0.12)';
      for (let x = 0; x <= width; x += 12) {
        const y = waveYCenter + Math.sin(x * 0.004 + phase * 0.8) * 38;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.beginPath();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = dark ? 'rgba(245, 158, 11, 0.11)' : 'rgba(217, 119, 6, 0.1)';
      for (let x = 0; x <= width; x += 12) {
        const y = waveYCenter + Math.cos(x * 0.0035 - phase * 0.6) * 28;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // 3. Floating Symbols & Geometric Shapes
      for (const item of items) {
        if (!prefersReducedMotion) {
          item.x += item.vx;
          item.y += item.vy;
          item.rotation += item.vRot;

          if (item.y < -50) item.y = height + 40;
          if (item.y > height + 50) item.y = -40;
          if (item.x < -60) item.x = width + 50;
          if (item.x > width + 60) item.x = -50;
        }

        ctx.save();
        ctx.translate(item.x, item.y);

        const color = item.isGold
          ? dark
            ? `rgba(251, 191, 36, ${item.alpha})`
            : `rgba(180, 83, 9, ${item.alpha * 0.9})`
          : dark
            ? `rgba(34, 211, 238, ${item.alpha})`
            : `rgba(3, 105, 161, ${item.alpha * 0.9})`;

        if (item.shapeType === 'triangle') {
          ctx.rotate(item.rotation);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.4;
          const s = item.size;
          // Right-angle triangle with right-angle square indicator (Pythagoras)
          ctx.beginPath();
          ctx.moveTo(-s * 0.5, s * 0.5);
          ctx.lineTo(s * 0.6, s * 0.5);
          ctx.lineTo(-s * 0.5, -s * 0.5);
          ctx.closePath();
          ctx.stroke();

          ctx.strokeRect(-s * 0.5, s * 0.5 - 6, 6, 6);
        } else if (item.shapeType === 'circle') {
          ctx.rotate(item.rotation);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.arc(0, 0, item.size * 0.55, 0, Math.PI * 2);
          ctx.stroke();
          // Radius line
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(item.size * 0.55, 0);
          ctx.stroke();
        } else {
          ctx.direction = 'ltr';
          ctx.fillStyle = color;
          ctx.font = `600 ${item.size}px "JetBrains Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(item.text, 0, 0);
        }

        ctx.restore();
      }

      if (!prefersReducedMotion) {
        phase += 0.025;
        timeoutId = window.setTimeout(() => {
          animationFrameId = window.requestAnimationFrame(render);
        }, 40);
      }
    };

    let timeoutId = 0;
    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (timeoutId) window.clearTimeout(timeoutId);
      if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-testid="math-background-canvas"
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0"
    />
  );
};
