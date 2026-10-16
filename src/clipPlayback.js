// Bound playback to a section of the original video, including after seeking.
export function createClipPlayback(player, { id, start = 0, seconds }, { onProgress, onFinish }) {
  const length = Math.min(30, Math.max(1, seconds));
  let finished = false;
  let started = false;
  let synchronized = false;
  let timer;
  const finish = () => {
    // YouTube can briefly report the previous video's time/ENDED state while
    // loading. It is not evidence that this round's clip has been watched.
    if (finished || !synchronized) return;
    finished = true;
    clearInterval(timer);
    player.pauseVideo();
    onFinish();
  };
  const poll = () => {
    const position = player.getCurrentTime();
    if (!Number.isFinite(position)) return;
    if (!synchronized) {
      if (position < start - 0.5 || position > start + 2) {
        player.seekTo(start, true);
        return;
      }
      synchronized = true;
    }
    if (position < start - 0.5) {
      player.seekTo(start, true);
      return;
    }
    const elapsed = Math.max(0, position - start);
    onProgress(Math.min(length, Math.floor(elapsed)));
    if (elapsed >= length) finish();
  };
  return {
    load: () => {
      onProgress(0);
      player.loadVideoById({ videoId: id, startSeconds: start, endSeconds: start + length });
    },
    start: () => {
      if (started || finished) return;
      started = true;
      player.seekTo(start, true);
      timer = setInterval(poll, 100);
    },
    finish,
    destroy: () => { finished = true; clearInterval(timer); },
  };
}
