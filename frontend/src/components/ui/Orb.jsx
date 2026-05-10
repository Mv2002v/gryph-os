import { useEffect } from 'react';

// Inject all orb keyframes once into <head>
function useOrbKeyframes() {
  useEffect(() => {
    const id = 'gryph-orb-kf';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes orbPulse {
        0%, 100% { transform: scale(1); }
        50% {
          transform: scale(1.05);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.08),
            0 0 50px rgba(34,211,238,0.7),
            0 0 120px rgba(167,139,250,0.5),
            inset 0 0 40px rgba(255,255,255,0.25);
        }
      }
      @keyframes orbPulseFast {
        0%, 100% { transform: scale(1); }
        50% {
          transform: scale(1.08);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.1),
            0 0 60px rgba(34,211,238,0.8),
            0 0 130px rgba(167,139,250,0.6),
            inset 0 0 50px rgba(255,255,255,0.3);
        }
      }
      @keyframes orbSpeak {
        0%, 100% { transform: scale(1); }
        25% { transform: scale(1.06); }
        75% { transform: scale(0.97); }
      }
      @keyframes orbSpin {
        to { transform: rotate(360deg); }
      }
      @keyframes orbSpinFast {
        to { transform: rotate(360deg); }
      }
      @keyframes orbRing {
        0%, 100% { transform: scale(1); opacity: 0.8; }
        50% { transform: scale(1.1); opacity: 0.3; }
      }
      @keyframes orbThinkDash {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }, []);
}

export function Orb({ size = 80, state = 'idle' }) {
  useOrbKeyframes();

  const isThinking = state === 'thinking';
  const isSpeaking = state === 'speaking';

  const pulseAnimation = isSpeaking
    ? 'orbSpeak 1.5s ease-in-out infinite'
    : isThinking
    ? 'orbPulseFast 2s ease-in-out infinite'
    : 'orbPulse 4s ease-in-out infinite';

  const spinDuration = isThinking ? '3s' : '6s';

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-grid',
        placeItems: 'center',
        width: size + size * 0.8,   // leave room for rings
        height: size + size * 0.8,
      }}
    >
      {/* Outer ring (r2) — violet */}
      <span
        style={{
          position: 'absolute',
          inset: '0%',
          borderRadius: '50%',
          border: `1px solid rgba(167,139,250,${isThinking ? '0.25' : '0.14'})`,
          animation: 'orbRing 4s ease-in-out infinite',
          animationDelay: '-2s',
          pointerEvents: 'none',
        }}
      />

      {/* Inner ring — cyan */}
      <span
        style={{
          position: 'absolute',
          inset: '10%',
          borderRadius: '50%',
          border: `1px solid rgba(34,211,238,${isThinking ? '0.28' : '0.18'})`,
          animation: 'orbRing 4s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />

      {/* Core orb */}
      <span
        style={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.85), rgba(34,211,238,0.7) 28%, rgba(167,139,250,0.6) 60%, rgba(236,72,153,0.5) 100%)',
          filter: 'blur(0.4px) saturate(1.1)',
          boxShadow:
            '0 0 0 1px rgba(255,255,255,0.06), 0 0 30px rgba(34,211,238,0.55), 0 0 80px rgba(167,139,250,0.35), inset 0 0 30px rgba(255,255,255,0.18)',
          animation: pulseAnimation,
          zIndex: 1,
        }}
      >
        {/* Spinning arc overlay */}
        <span
          style={{
            position: 'absolute',
            inset: '-8%',
            borderRadius: '50%',
            background:
              'conic-gradient(from 0deg, transparent 0 30%, rgba(34,211,238,0.5) 50%, transparent 70%)',
            filter: 'blur(8px)',
            animation: `orbSpin ${spinDuration} linear infinite`,
            opacity: isThinking ? 0.9 : 0.6,
          }}
        />

        {/* Thinking dashed orbit ring */}
        {isThinking && (
          <span
            style={{
              position: 'absolute',
              inset: '-60%',
              borderRadius: '50%',
              borderTop: '1px dashed rgba(34,211,238,0.5)',
              animation: 'orbThinkDash 2.4s linear infinite',
            }}
          />
        )}
      </span>
    </span>
  );
}

export default Orb;
