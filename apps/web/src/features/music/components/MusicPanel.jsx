import { useEffect, useState } from 'react';
import { Check, Link2, Loader2, Music, Play, Plus, Search, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useMusic } from '../MusicProvider';
import { musicApi } from '../api/musicApi';
import { formatDuration } from '../format';

const inputClass =
  'h-10 w-full rounded-full border border-border bg-stage-raised pl-9 pr-4 text-sm text-paper outline-none placeholder:text-paper-muted/60 focus:border-ember';

// No answer from the server at all, or the server's own message
function errText(err, fallback) {
  if (!err?.response) return "Can't reach the server right now. Check your internet connection and try again.";
  return err.response.data?.message || fallback;
}

export default function MusicPanel({ room }) {
  const { room: active, state, connected, error, actions, joinMusic } = useMusic();
  const joined = active?.id === room.id;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [slow, setSlow] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [adding, setAdding] = useState(null);

  const [link, setLink] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkMsg, setLinkMsg] = useState(null);

  // Start listening when the Music room opens. Leaving the page does not stop the music.
  useEffect(() => {
    joinMusic(room.id, room.name);
  }, [room.id, room.name, joinMusic]);

  const inQueue = (videoId) => state.queue.some((q) => q.videoId === videoId);

  const onSearch = async (e) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      setSearchError('Type at least 2 characters to search.');
      return;
    }
    setSearching(true);
    setSlow(false);
    setSearchError('');
    const slowTimer = setTimeout(() => setSlow(true), 5000);
    try {
      setResults(await musicApi.search(q));
      setSearched(true);
    } catch (err) {
      setResults([]);
      setSearched(false);
      setSearchError(errText(err, 'Search failed. Please try again.'));
    } finally {
      clearTimeout(slowTimer);
      setSlow(false);
      setSearching(false);
    }
  };

  const addTrack = async (track) => {
    setAdding(track.videoId);
    await actions.add(track);
    setAdding(null);
  };

  const onAddLink = async (e) => {
    e.preventDefault();
    const url = link.trim();
    if (!url) return;
    setLinkBusy(true);
    setLinkMsg(null);
    try {
      const track = await musicApi.resolve(url);
      const res = await actions.add(track);
      if (res?.ok) {
        setLink('');
        setLinkMsg({ ok: true, text: `Added: ${track.title}` });
      } else {
        setLinkMsg({ ok: false, text: res?.message || 'Could not add the song.' });
      }
    } catch (err) {
      setLinkMsg({ ok: false, text: errText(err, 'Could not read that link.') });
    } finally {
      setLinkBusy(false);
    }
  };

  return (
    <div className="surface flex min-h-0 flex-col gap-4 rounded-xl2 p-3 sm:p-4 lg:flex-1 lg:overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Music className="h-5 w-5 text-ember" />
          <h2 className="font-display font-bold text-paper">Music together</h2>
        </div>
        <span className="text-xs text-paper-muted">
          {!joined ? 'Not listening' : connected ? 'Everyone can control' : 'Reconnecting…'}
        </span>
      </div>

      {!joined && (
        <Button onClick={() => joinMusic(room.id, room.name)}>
          <Play className="h-4 w-4 fill-current" /> Start listening
        </Button>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Search */}
      <form onSubmit={onSearch} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-paper-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a song or artist…"
            className={inputClass}
          />
        </div>
        <Button type="submit" variant="secondary" size="sm" isLoading={searching}>
          Search
        </Button>
      </form>

      {searching && (
        <p className="flex items-center gap-2 text-xs text-paper-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {slow ? 'Still searching. The server may be waking up, this can take up to a minute…' : 'Searching…'}
        </p>
      )}
      {searchError && <p className="text-sm text-red-400">{searchError}</p>}
      {searched && !searching && results.length === 0 && (
        <p className="text-sm text-paper-muted">No playable songs found. Try different words.</p>
      )}

      {results.length > 0 && (
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {results.map((t) => {
            const added = inQueue(t.videoId);
            return (
              <div key={t.videoId} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5">
                <img src={t.thumbnail} alt="" loading="lazy" className="h-12 w-20 shrink-0 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-paper">{t.title}</p>
                  <p className="truncate text-xs text-paper-muted">
                    {t.channel} · {formatDuration(t.durationSec)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={added ? 'ghost' : 'secondary'}
                  disabled={added || !joined}
                  isLoading={adding === t.videoId}
                  onClick={() => addTrack(t)}
                >
                  {added ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Added
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" /> Add
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Paste a link */}
      <form onSubmit={onAddLink} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-paper-muted" />
          <input
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              setLinkMsg(null);
            }}
            placeholder="Or paste a YouTube link…"
            className={inputClass}
          />
        </div>
        <Button type="submit" variant="secondary" size="sm" isLoading={linkBusy} disabled={!joined || !link.trim()}>
          Add
        </Button>
      </form>
      {linkMsg && (
        <p className={`text-sm ${linkMsg.ok ? 'text-paper-muted' : 'text-red-400'}`}>{linkMsg.text}</p>
      )}

      {/* Queue */}
      <div>
        <p className="mb-2 text-sm font-semibold text-paper-muted">
          Queue &middot; {state.queue.length} song{state.queue.length === 1 ? '' : 's'}
        </p>

        {state.queue.length === 0 && (
          <p className="text-sm text-paper-muted">Nothing in the queue yet. Search for a song or paste a link.</p>
        )}

        <div className="max-h-72 space-y-1 overflow-y-auto lg:max-h-none">
          {state.queue.map((item, i) => {
            const current = i === state.index;
            return (
              <div
                key={item.id}
                className={`flex items-center gap-2 rounded-lg px-2 py-2 ${current ? 'bg-ember/10' : 'hover:bg-white/5'}`}
              >
                <button
                  type="button"
                  onClick={() => actions.playItem(item.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  title="Play this song"
                >
                  <img src={item.thumbnail} alt="" loading="lazy" className="h-10 w-16 shrink-0 rounded object-cover" />
                  <div className="min-w-0">
                    <p className={`truncate text-sm ${current ? 'text-ember' : 'text-paper'}`}>{item.title}</p>
                    <p className="truncate text-xs text-paper-muted">
                      {current ? (state.playing ? 'Playing now' : 'Current song') : item.channel} ·{' '}
                      {formatDuration(item.durationSec)}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => actions.remove(item.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-paper-muted hover:bg-white/10 hover:text-paper"
                  aria-label={`Remove ${item.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}