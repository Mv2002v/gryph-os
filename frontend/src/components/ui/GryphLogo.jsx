import { useEffect, useRef } from 'react';

const SIZE_MAP = {
  sm: { mark: 22, fontSize: 14 },
  md: { mark: 28, fontSize: 18 },
  lg: { mark: 40, fontSize: 24 },
};

export function GryphLogo({ tagline, size = 'md' }) {
  const { mark, fontSize } = SIZE_MAP[size] ?? SIZE_MAP.md;
  const markRef = useRef(null);

  // inject keyframes once
  useEffect(() => {
    const id = 'gryph-logo-spin-kf';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes gryphLogoSpin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
  }, []);

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        fontFamily: "'Space Grotesk', ui-sans-serif, system-ui",
        fontWeight: 600,
        letterSpacing: '0.06em',
        fontSize,
        color: 'var(--gos-text, #0a1330)',
      }}
    >
      {/* Logo mark — animated conic-gradient ring */}
      <span
        ref={markRef}
        style={{
          position: 'relative',
          display: 'inline-block',
          width: mark,
          height: mark,
          borderRadius: '50%',
          background:
            'conic-gradient(from 220deg, var(--gos-cyan, #22d3ee), var(--gos-violet, #a78bfa), var(--gos-magenta, #ec4899), var(--gos-cyan, #22d3ee))',
          filter: 'drop-shadow(0 0 12px rgba(34,211,238,0.4))',
          animation: 'gryphLogoSpin 14s linear infinite',
          flexShrink: 0,
        }}
      >
        {/* inner cutout */}
        <span
          style={{
            position: 'absolute',
            inset: 4,
            borderRadius: '50%',
            background: 'var(--gos-bg, #f4f6fc)',
          }}
        />
        {/* core glow */}
        <span
          style={{
            position: 'absolute',
            inset: 8,
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 30% 30%, var(--gos-cyan-2, #67e8f9), var(--gos-cyan, #22d3ee) 35%, var(--gos-violet, #a78bfa) 75%)',
            boxShadow: '0 0 14px rgba(34,211,238,0.6)',
          }}
        />
      </span>

      {/* Word mark */}
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
        <span>GRYPH</span>
        <span style={{ color: 'var(--gos-cyan, #22d3ee)' }}>·</span>
        <span>OS</span>
      </span>

      {/* Optional tagline */}
      {tagline && (
        <span
          style={{
            marginLeft: 14,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 10,
            letterSpacing: '0.3em',
            color: 'var(--gos-muted, #6e7a98)',
            textTransform: 'uppercase',
          }}
        >
          {tagline}
        </span>
      )}
    </div>
  );
}

export default GryphLogo;
