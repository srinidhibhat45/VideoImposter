const LIMIT = 64;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

// Oldest first; only IDs are kept, never a playback position or private role.
export function mergeVideoHistory(...histories) {
  const recent = new Set();
  for (const history of histories) {
    if (!Array.isArray(history)) continue;
    for (const id of history.slice(-LIMIT)) {
      if (typeof id !== 'string' || !VIDEO_ID.test(id)) continue;
      recent.delete(id);
      recent.add(id);
    }
  }
  return [...recent].slice(-LIMIT);
}

export function readVideoHistory(storage) {
  try { return mergeVideoHistory(JSON.parse(storage.getItem('alibi-recent-videos'))); }
  catch { return []; }
}

export function rememberVideos(storage, ids) {
  const history = mergeVideoHistory(readVideoHistory(storage), ids);
  try { storage.setItem('alibi-recent-videos', JSON.stringify(history)); } catch { /* Storage can be unavailable in private browsing. */ }
  return history;
}
