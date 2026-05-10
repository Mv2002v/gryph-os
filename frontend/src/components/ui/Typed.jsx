import { useState, useEffect } from 'react';

// Inject blink keyframe once
function useBlinkKeyframe() {
  useEffect(() => {
    const id = 'gryph-typed-blink-kf';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes typedBlink {
        50% { opacity: 0.2; }
      }
    `;
    document.head.appendChild(style);
  }, []);
}

export function Typed({
  text,
  speed = 40,
  delay = 0,
  caret = true,
  onDone,
  className,
}) {
  useBlinkKeyframe();

  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    let interval;

    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(interval);
          setDone(true);
          if (onDone) onDone();
        }
      }, speed);
    }, delay);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [text, speed, delay]); // onDone intentionally omitted — callers should memoize

  return (
    <span className={className}>
      {displayed}
      {caret && !done && (
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: '1em',
            verticalAlign: '-2px',
            background: 'var(--gos-cyan-deep, #0ea5c4)',
            marginLeft: 3,
            animation: 'typedBlink 1s steps(2) infinite',
          }}
        />
      )}
    </span>
  );
}

export default Typed;
