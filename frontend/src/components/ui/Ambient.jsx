import { useEffect } from 'react';

function useAmbientKeyframes() {
  useEffect(() => {
    const id = 'gryph-ambient-kf';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes ambDrift1 {
        0%   { transform: translate(0, 0) scale(1); }
        50%  { transform: translate(60px, -40px) scale(1.1); }
        100% { transform: translate(0, 0) scale(1); }
      }
      @keyframes ambDrift2 {
        0%   { transform: translate(0, 0) scale(1.05); }
        50%  { transform: translate(-50px, 30px) scale(0.95); }
        100% { transform: translate(0, 0) scale(1.05); }
      }
    `;
    document.head.appendChild(style);
  }, []);
}

export function Ambient() {
  useAmbientKeyframes();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Layer 1 — deep grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(var(--gos-grid-line, rgba(20,60,140,0.10)) 1px, transparent 1px),
            linear-gradient(90deg, var(--gos-grid-line, rgba(20,60,140,0.10)) 1px, transparent 1px)
          `,
          backgroundSize: '280px 280px, 280px 280px',
          maskImage:
            'radial-gradient(ellipse at center, black 20%, transparent 80%)',
          WebkitMaskImage:
            'radial-gradient(ellipse at center, black 20%, transparent 80%)',
        }}
      />

      {/* Layer 2a — cyan drift orb (top-left) */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '-8%',
          width: 480,
          height: 480,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, var(--gos-cyan, #22d3ee), transparent 70%)',
          filter: 'blur(90px)',
          opacity: 0.25,
          animation: 'ambDrift1 14s ease-in-out infinite',
        }}
      />

      {/* Layer 2b — magenta drift orb (bottom-right) */}
      <div
        style={{
          position: 'absolute',
          bottom: '-12%',
          right: '-10%',
          width: 480,
          height: 480,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, var(--gos-magenta, #ec4899), transparent 70%)',
          filter: 'blur(90px)',
          opacity: 0.2,
          animation: 'ambDrift2 18s ease-in-out infinite',
        }}
      />

      {/* Layer 2c — violet drift orb (center-right) */}
      <div
        style={{
          position: 'absolute',
          top: '40%',
          right: '20%',
          width: 260,
          height: 260,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, var(--gos-violet, #a78bfa), transparent 70%)',
          filter: 'blur(90px)',
          opacity: 0.2,
          animation: 'ambDrift1 16s ease-in-out infinite',
          animationDelay: '-5s',
        }}
      />

      {/* Layer 3 — scanlines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 3px)',
          mixBlendMode: 'overlay',
        }}
      />
    </div>
  );
}

export default Ambient;
