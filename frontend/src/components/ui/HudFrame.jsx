import { useEffect } from 'react';

function useHudKeyframes() {
  useEffect(() => {
    const id = 'gryph-hud-kf';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes hudBlink {
        50% { opacity: 0.2; }
      }
    `;
    document.head.appendChild(style);
  }, []);
}

const BRACKET_COLOR = 'rgba(34,211,238,0.4)';
const BRACKET_W = 32;
const BRACKET_OFFSET = 20;

export function HudFrame({ status = 'SYS·ONLINE', version = 'v2.1' }) {
  useHudKeyframes();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      {/* top-left corner */}
      <div
        style={{
          position: 'absolute',
          top: BRACKET_OFFSET,
          left: BRACKET_OFFSET,
          width: BRACKET_W,
          height: BRACKET_W,
          borderTop: `1.5px solid ${BRACKET_COLOR}`,
          borderLeft: `1.5px solid ${BRACKET_COLOR}`,
        }}
      />

      {/* top-right corner */}
      <div
        style={{
          position: 'absolute',
          top: BRACKET_OFFSET,
          right: BRACKET_OFFSET,
          width: BRACKET_W,
          height: BRACKET_W,
          borderTop: `1.5px solid ${BRACKET_COLOR}`,
          borderRight: `1.5px solid ${BRACKET_COLOR}`,
        }}
      />

      {/* bottom-left corner */}
      <div
        style={{
          position: 'absolute',
          bottom: BRACKET_OFFSET,
          left: BRACKET_OFFSET,
          width: BRACKET_W,
          height: BRACKET_W,
          borderBottom: `1.5px solid ${BRACKET_COLOR}`,
          borderLeft: `1.5px solid ${BRACKET_COLOR}`,
        }}
      />

      {/* bottom-right corner */}
      <div
        style={{
          position: 'absolute',
          bottom: BRACKET_OFFSET,
          right: BRACKET_OFFSET,
          width: BRACKET_W,
          height: BRACKET_W,
          borderBottom: `1.5px solid ${BRACKET_COLOR}`,
          borderRight: `1.5px solid ${BRACKET_COLOR}`,
        }}
      />

      {/* top-left live readout */}
      <div
        style={{
          position: 'absolute',
          top: 32,
          left: 80,
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 10.5,
          letterSpacing: '0.18em',
          color: 'var(--gos-muted, #6e7a98)',
          textTransform: 'uppercase',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {/* live pulse dot */}
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--gos-emerald, #34d399)',
            boxShadow: '0 0 10px var(--gos-emerald, #34d399)',
            animation: 'hudBlink 1.4s ease-in-out infinite',
            display: 'inline-block',
          }}
        />
        GRYPH-OS
      </div>

      {/* bottom-right version + status readout */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          right: 24,
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 10,
          color: 'rgba(34,211,238,0.5)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        {status} · {version}
      </div>
    </div>
  );
}

export default HudFrame;
