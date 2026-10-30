export const CAMERA_CONSTRAINTS = {
  width: { ideal: 480, max: 640 },
  height: { ideal: 270, max: 360 },
  frameRate: { ideal: 15, max: 20 },
  facingMode: 'user',
};

export async function limitCallBandwidth(pc) {
  await Promise.all(pc.getSenders().map(async sender => {
    if (!sender.track || sender.track.kind !== 'video') return;
    try {
      const params = sender.getParameters();
      if (!params.encodings?.length) return;
      params.encodings.forEach(encoding => { encoding.maxBitrate = 250_000; encoding.maxFramerate = 15; });
      await sender.setParameters(params);
    } catch { /* Some browsers cannot change encodings; capture is still limited. */ }
  }));
}
