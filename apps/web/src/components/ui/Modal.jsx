import { useEffect } from 'react';

export default function Modal({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className="surface w-full max-w-md rounded-xl2 p-5 text-paper shadow-card"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-paper">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="px-2 text-xl leading-none text-paper-muted hover:text-paper"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}