import { useState } from 'react';

const SIZE_MAP = { xs: 24, sm: 36, md: 44, lg: 80, xl: 96 };

export default function Avatar({ user, name, src, size = 36, live = false }) {
  const [failed, setFailed] = useState(false);

  const label = name || user?.displayName || user?.username || '?';
  const imageUrl = src || user?.avatarUrl || null;
  const px = typeof size === 'number' ? size : SIZE_MAP[size] || 36;
  const initials = label
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const style = { width: px, height: px, fontSize: px * 0.38 };

  return (
    <span className="relative inline-flex shrink-0" style={{ width: px, height: px }}>
      {imageUrl && !failed ? (
        <img
          src={imageUrl}
          alt=""
          style={style}
          className="rounded-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          style={style}
          className="inline-flex items-center justify-center rounded-full font-semibold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100"
        >
          {initials}
        </span>
      )}
      {live && (
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-stage-raised" />
      )}
    </span>
  );
}