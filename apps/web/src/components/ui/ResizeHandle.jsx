import { useRef } from 'react';

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const resolve = (v) => (typeof v === 'function' ? v() : v);

// A bar you drag (mouse or finger) to change a size. Double-click resets it.
export default function ResizeHandle({
  direction = 'horizontal', // horizontal: drag left/right, vertical: drag up/down
  getValue,
  onChange,
  min,
  max,
  invert = false, // true when dragging towards the start makes the thing bigger
  onReset,
  label = 'Resize',
  className = '',
}) {
  const startRef = useRef(null);
  const horizontal = direction === 'horizontal';

  const onPointerDown = (e) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* not supported */
    }
    startRef.current = { pos: horizontal ? e.clientX : e.clientY, value: getValue() };
  };

  const onPointerMove = (e) => {
    const start = startRef.current;
    if (!start) return;
    let delta = (horizontal ? e.clientX : e.clientY) - start.pos;
    if (invert) delta = -delta;
    onChange(Math.round(clamp(start.value + delta, resolve(min), resolve(max))));
  };

  const onPointerUp = (e) => {
    startRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const onKeyDown = (e) => {
    const keys = horizontal ? { dec: 'ArrowLeft', inc: 'ArrowRight' } : { dec: 'ArrowUp', inc: 'ArrowDown' };
    if (e.key !== keys.dec && e.key !== keys.inc) return;
    e.preventDefault();
    const step = e.shiftKey ? 60 : 20;
    let delta = e.key === keys.inc ? step : -step;
    if (invert) delta = -delta;
    onChange(Math.round(clamp(getValue() + delta, resolve(min), resolve(max))));
  };

  return (
    <div
      role="separator"
      aria-orientation={horizontal ? 'vertical' : 'horizontal'}
      aria-label={label}
      title={`${label} (drag, double-click to reset)`}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      className={`group touch-none select-none items-center justify-center ${
        horizontal ? 'w-4 cursor-col-resize' : 'h-5 w-full cursor-row-resize'
      } ${className}`}
    >
      <span
        className={`rounded-full bg-border-strong transition-colors group-hover:bg-ember group-focus-visible:bg-ember ${
          horizontal ? 'h-12 w-1' : 'h-1 w-12'
        }`}
      />
    </div>
  );
}