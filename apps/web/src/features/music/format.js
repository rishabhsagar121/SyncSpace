export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

// Where the song should be right now, worked out from the last state the server sent
export function expectedPositionMs(state, now = Date.now()) {
  const item = state.queue[state.index];
  let position = state.positionNowMs || 0;
  if (state.playing) position += now - state.receivedAt;
  const max = item?.durationSec ? item.durationSec * 1000 : Infinity;
  return Math.max(0, Math.min(position, max));
}