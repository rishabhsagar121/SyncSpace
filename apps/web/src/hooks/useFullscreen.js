import { useCallback, useEffect, useState } from 'react';

// Opens one element in full screen. `supported` is false on browsers that cannot do it (like iPhone).
export function useFullscreen(ref) {
  const [active, setActive] = useState(false);
  const supported =
    typeof document !== 'undefined' && !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);

  useEffect(() => {
    const onChange = () => {
      const el = document.fullscreenElement || document.webkitFullscreenElement;
      setActive(!!el && el === ref.current);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, [ref]);

  const toggle = useCallback(async () => {
    const el = ref.current;
    if (!el) return;
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        await (document.exitFullscreen?.() ?? document.webkitExitFullscreen?.());
      } else {
        await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
      }
    } catch {
      /* the browser refused: nothing to do */
    }
  }, [ref]);

  return { supported, active, toggle };
}