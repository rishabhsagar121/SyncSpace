import { UserMinus, UserPlus, X } from 'lucide-react';

// Small popups in the top-right corner. Each one is removed by the page that shows it.
export default function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed right-3 top-16 z-[70] flex w-[min(92vw,340px)] flex-col gap-2 sm:right-5">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="surface pointer-events-auto flex animate-rise-in items-center gap-3 rounded-xl2 px-4 py-3 text-sm text-paper shadow-card"
        >
          {t.kind === 'leave' ? (
            <UserMinus className="h-4 w-4 shrink-0 text-ember" />
          ) : (
            <UserPlus className="h-4 w-4 shrink-0 text-ember" />
          )}
          <span className="min-w-0 flex-1 break-words">{t.text}</span>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            className="shrink-0 text-paper-muted hover:text-paper"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}