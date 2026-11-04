import { forwardRef, useId } from 'react';
import clsx from 'clsx';

const Input = forwardRef(function Input(
  { label, error, hint, className, id, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-paper-muted">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={clsx(
          'h-11 rounded-xl border bg-stage-raised px-4 text-sm text-paper placeholder:text-paper-muted/60',
          'transition-colors duration-150 outline-none',
          'focus:border-ember',
          error ? 'border-ember-dim' : 'border-border',
          className
        )}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-xs text-ember-hot">
          {error}
        </p>
      )}
      {!error && hint && <p className="text-xs text-paper-muted">{hint}</p>}
    </div>
  );
});

export default Input;