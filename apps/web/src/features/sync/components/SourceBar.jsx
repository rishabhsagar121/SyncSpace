// apps/web/src/features/sync/components/SourceBar.jsx
import { useState } from 'react';
import { LinkIcon } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function SourceBar({ onSetSource }) {
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    const ok = onSetSource(value);
    setInvalid(!ok);
    if (ok) setValue('');
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <div className="relative flex-1">
        <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-paper-muted" />
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setInvalid(false);
          }}
          placeholder="Paste a YouTube link…"
          className={`h-10 w-full rounded-full border bg-stage-raised pl-9 pr-4 text-sm text-paper outline-none placeholder:text-paper-muted/60 focus:border-ember ${
            invalid ? 'border-ember-dim' : 'border-border'
          }`}
        />
      </div>
      <Button type="submit" variant="secondary" size="sm">
        Load
      </Button>
    </form>
  );
}