import { useEffect } from 'react';

function useFlowKeyframes() {
  useEffect(() => {
    const id = 'gryph-flow-kf';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes flowProgressBar {
        from { transform: translateX(-100%); }
        to   { transform: translateX(0); }
      }
    `;
    document.head.appendChild(style);
  }, []);
}

const monoFont = "'JetBrains Mono', ui-monospace, monospace";

export function FlowControls({ total, current, onPrev, onNext, onRestart }) {
  useFlowKeyframes();

  const isFirst = current === 0;
  const isLast = current === total - 1;

  const btnBase = {
    fontFamily: monoFont,
    fontSize: 11,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    background: 'rgba(20,40,90,0.04)',
    border: '1px solid rgba(20,40,90,0.10)',
    borderRadius: 999,
    color: 'var(--gos-text-2, #404c6e)',
    padding: '6px 12px',
    cursor: 'pointer',
    transition: 'border-color 180ms, color 180ms, background 180ms',
  };

  const btnDisabled = {
    ...btnBase,
    opacity: 0.35,
    cursor: 'not-allowed',
  };

  return (
    <>
      {/* Progress dots — fixed bottom-left */}
      <div
        style={{
          position: 'fixed',
          left: 22,
          bottom: 22,
          display: 'flex',
          gap: 6,
          zIndex: 50,
        }}
      >
        {Array.from({ length: total }).map((_, i) => {
          const isDone = i < current;
          const isActive = i === current;
          return (
            <div
              key={i}
              style={{
                width: 28,
                height: 4,
                borderRadius: 2,
                background: isDone
                  ? 'var(--gos-cyan, #22d3ee)'
                  : 'rgba(20,40,90,0.08)',
                border: isDone
                  ? '1px solid var(--gos-cyan, #22d3ee)'
                  : '1px solid rgba(20,40,90,0.10)',
                boxShadow: isDone
                  ? '0 0 10px rgba(34,211,238,0.6)'
                  : 'none',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {isActive && (
                <span
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(90deg, var(--gos-cyan, #22d3ee), var(--gos-violet, #a78bfa))',
                    animation: 'flowProgressBar 4s linear forwards',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Controls pill — fixed bottom-right */}
      <div
        style={{
          position: 'fixed',
          right: 22,
          bottom: 22,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          zIndex: 50,
          fontFamily: monoFont,
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          background: 'rgba(255,255,255,0.85)',
          border: '1px solid rgba(20,40,90,0.10)',
          borderRadius: 999,
          padding: '8px 10px 8px 14px',
          backdropFilter: 'blur(14px)',
          color: 'var(--gos-text-2, #404c6e)',
          boxShadow: '0 10px 30px rgba(20,40,90,0.12)',
        }}
      >
        {/* Position counter */}
        <span>
          <span style={{ color: 'var(--gos-cyan, #22d3ee)' }}>
            {String(current + 1).padStart(2, '0')}
          </span>
          {' / '}
          {String(total).padStart(2, '0')}
        </span>

        {/* Separator */}
        <span
          style={{
            width: 1,
            height: 14,
            background: 'rgba(20,40,90,0.10)',
          }}
        />

        {/* Prev button */}
        <button
          onClick={onPrev}
          disabled={isFirst}
          style={isFirst ? btnDisabled : btnBase}
          onMouseEnter={(e) => {
            if (!isFirst) {
              e.currentTarget.style.color = 'var(--gos-cyan, #22d3ee)';
              e.currentTarget.style.borderColor = 'var(--gos-cyan, #22d3ee)';
              e.currentTarget.style.background = 'rgba(34,211,238,0.08)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--gos-text-2, #404c6e)';
            e.currentTarget.style.borderColor = 'rgba(20,40,90,0.10)';
            e.currentTarget.style.background = 'rgba(20,40,90,0.04)';
          }}
        >
          ← Back
        </button>

        {/* Next button */}
        <button
          onClick={onNext}
          disabled={isLast}
          style={isLast ? btnDisabled : btnBase}
          onMouseEnter={(e) => {
            if (!isLast) {
              e.currentTarget.style.color = 'var(--gos-cyan, #22d3ee)';
              e.currentTarget.style.borderColor = 'var(--gos-cyan, #22d3ee)';
              e.currentTarget.style.background = 'rgba(34,211,238,0.08)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--gos-text-2, #404c6e)';
            e.currentTarget.style.borderColor = 'rgba(20,40,90,0.10)';
            e.currentTarget.style.background = 'rgba(20,40,90,0.04)';
          }}
        >
          {isLast ? 'Enter' : 'Next →'}
        </button>

        {/* Restart button — only on last step when handler provided */}
        {onRestart && isLast && (
          <>
            <span
              style={{
                width: 1,
                height: 14,
                background: 'rgba(20,40,90,0.10)',
              }}
            />
            <button
              onClick={onRestart}
              style={btnBase}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--gos-cyan, #22d3ee)';
                e.currentTarget.style.borderColor = 'var(--gos-cyan, #22d3ee)';
                e.currentTarget.style.background = 'rgba(34,211,238,0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--gos-text-2, #404c6e)';
                e.currentTarget.style.borderColor = 'rgba(20,40,90,0.10)';
                e.currentTarget.style.background = 'rgba(20,40,90,0.04)';
              }}
            >
              ↺ Replay
            </button>
          </>
        )}
      </div>
    </>
  );
}

export default FlowControls;
