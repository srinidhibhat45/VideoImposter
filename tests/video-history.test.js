import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeVideoHistory, readVideoHistory, rememberVideos } from '../shared/videoHistory.js';

test('recent video IDs survive a new room without storing playback times', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  rememberVideos(storage, ['4HGNqFdaD34', 'oSyEZAm8nb8']);
  rememberVideos(storage, ['4HGNqFdaD34']);
  assert.deepEqual(readVideoHistory(storage), ['oSyEZAm8nb8', '4HGNqFdaD34']);
  assert.deepEqual([...data.keys()], ['alibi-recent-videos']);
});

test('history is bounded and validates input received from storage or a client', () => {
  const ids = Array.from({ length: 80 }, (_, i) => String(i).padStart(11, '0'));
  const history = mergeVideoHistory(ids, [null, {}, 25, 'bad', '4HGNqFdaD34']);
  assert.equal(history.length, 64);
  assert.equal(history.at(-1), '4HGNqFdaD34');
  assert.equal(history.includes(ids[0]), false);
  assert.deepEqual(mergeVideoHistory('not-an-array', { id: ids[0] }), []);
});

test('corrupt or unavailable storage cannot break joining or room updates', () => {
  assert.deepEqual(readVideoHistory({ getItem: () => '{invalid' }), []);
  const denied = { getItem: () => { throw new Error('Denied'); }, setItem: () => { throw new Error('Denied'); } };
  assert.deepEqual(rememberVideos(denied, ['4HGNqFdaD34']), ['4HGNqFdaD34']);
});
