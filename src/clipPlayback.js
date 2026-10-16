// Bound playback to a section of the original video, including after seeking.
export function createClipPlayback(player, { start = 0, seconds }, { onProgress, onFinish }) {
  const length = Math.min(30, Math.max(1, seconds));
  let finished = false;
  let timer;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearInterval(timer);
    player.pauseVideo();
    onFinish();
  };
  timer = setInterval(() => {
    const position = player.getCurrentTime();
    if (!Number.isFinite(position)) return;
    if (position < start - 0.5) {
      player.seekTo(start, true);
      return;
    }
    const elapsed = Math.max(0, position - start);
    onProgress(Math.min(length, Math.floor(elapsed)));
    if (elapsed >= length) finish();
  }, 100);
  return { finish, destroy: () => { finished = true; clearInterval(timer); } };
}
