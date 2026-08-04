import clsx from 'clsx';

export default function SyncPulse({ size = 32, live = false, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={clsx(live && 'animate-pulse-sync', className)}
      role="img"
      aria-label="SyncSpace"
    >
      <circle cx="12" cy="16" r="10" fill="#6C5CE7" fillOpacity="0.85" />
      <circle cx="20" cy="16" r="10" fill="#00D9C0" fillOpacity="0.85" style={{ mixBlendMode: 'screen' }} />
    </svg>
  );
}