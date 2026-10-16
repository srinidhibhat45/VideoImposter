import test from 'node:test';
import assert from 'node:assert/strict';
import { createClipPlayback } from '../src/clipPlayback.js';

function fixture(t, seconds = 30, position = 15) {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const state = { position, pauses: 0, finishes: 0, progress: 0, seeks: [], loads: [] };
  const playback = createClipPlayback({
    loadVideoById: value => state.loads.push(value),
    getCurrentTime: () => state.position,
    pauseVideo: () => state.pauses++,
    seekTo: value => state.seeks.push(value),
  }, { id: '4HGNqFdaD34', start: 15, seconds }, {
    onProgress: value => state.progress = value,
    onFinish: () => state.finishes++,
  });
  playback.load();
  playback.start();
  t.mock.timers.tick(100);
  t.after(() => playback.destroy());
  return { state, playback };
}

test('stops at the segment end, rather than 30 seconds into the source video', t => {
  const { state, playback } = fixture(t);
  state.position = 44.9;
  t.mock.timers.tick(100);
  assert.equal(state.finishes, 0);
  state.position = 45;
  t.mock.timers.tick(100);
  assert.equal(state.progress, 30);
  assert.equal(state.pauses, 1);
  assert.equal(state.finishes, 1);
  playback.finish();
  t.mock.timers.tick(1000);
  assert.equal(state.finishes, 1);
});

test('a short video can finish early and cleanup prevents a late completion', t => {
  const { state, playback } = fixture(t);
  playback.finish();
  assert.equal(state.finishes, 1);
  playback.destroy();
  state.position = 60;
  t.mock.timers.tick(1000);
  assert.equal(state.finishes, 1);
});

test('seeking before the segment returns to its start and seeking past it finishes', t => {
  const { state } = fixture(t);
  state.position = 0;
  t.mock.timers.tick(100);
  assert.deepEqual(state.seeks, [15, 15]);
  state.position = 90;
  t.mock.timers.tick(100);
  assert.equal(state.progress, 30);
  assert.equal(state.finishes, 1);
});

test('shorter selections stop at their configured duration', t => {
  const { state } = fixture(t, 15);
  state.position = 30;
  t.mock.timers.tick(100);
  assert.equal(state.finishes, 1);
});

test('client playback defensively caps a longer duration at 30 seconds', t => {
  const { state } = fixture(t, 60);
  state.position = 45;
  t.mock.timers.tick(100);
  assert.equal(state.progress, 30);
  assert.equal(state.finishes, 1);
});

test('unmounting clears the interval without marking an unfinished clip as watched', t => {
  const { state, playback } = fixture(t);
  playback.destroy();
  state.position = 45;
  t.mock.timers.tick(1000);
  assert.equal(state.finishes, 0);
  assert.equal(state.pauses, 0);
});

test('each clip explicitly reloads its assigned section, overriding a saved YouTube time', t => {
  const { state, playback } = fixture(t, 30, 150);
  assert.deepEqual(state.loads, [{ videoId: '4HGNqFdaD34', startSeconds: 15, endSeconds: 45 }]);
  playback.finish(); // A stale ENDED event must not skip this new clip.
  t.mock.timers.tick(1000);
  assert.equal(state.finishes, 0);
  assert.equal(state.progress, 0);
  assert.ok(state.seeks.every(value => value === 15));
  state.position = 15;
  t.mock.timers.tick(100);
  state.position = 16;
  t.mock.timers.tick(100);
  assert.equal(state.progress, 1);
  state.position = 45;
  t.mock.timers.tick(100);
  assert.equal(state.finishes, 1);
});

test('buffering or another PLAYING event does not rewind a clip already in progress', t => {
  const { state, playback } = fixture(t);
  state.position = 25;
  t.mock.timers.tick(100);
  playback.start();
  assert.equal(state.progress, 10);
  assert.deepEqual(state.seeks, [15]);
});
