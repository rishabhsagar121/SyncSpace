import clsx from 'clsx';

export default function SyncPulse({ size = 32, live = false, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={clsx(live && 'animate-pulse', className)}
      role="img"
      aria-label="SyncSpace"
    >
      <defs>
        <linearGradient id="syncPulseGradient" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0%" stopColor="#FF4D4D" />
          <stop offset="100%" stopColor="#FF8A3D" />
        </linearGradient>
      </defs>
      <path d="M16 4 L26 16 L16 28 L6 16 Z" fill="url(#syncPulseGradient)" />
      <circle cx="16" cy="16" r="4.5" fill="#09090B" />
    </svg>
  );
}