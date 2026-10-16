import test from 'node:test';
import assert from 'node:assert/strict';
import { createClipPlayback } from '../src/clipPlayback.js';

function fixture(t, seconds = 30) {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const state = { position: 15, pauses: 0, finishes: 0, progress: 0, seeks: [] };
  const playback = createClipPlayback({
    getCurrentTime: () => state.position,
    pauseVideo: () => state.pauses++,
    seekTo: value => state.seeks.push(value),
  }, { start: 15, seconds }, {
    onProgress: value => state.progress = value,
    onFinish: () => state.finishes++,
  });
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
  assert.deepEqual(state.seeks, [15]);
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
