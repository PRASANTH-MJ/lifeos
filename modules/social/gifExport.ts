import { Buffer } from 'buffer';
import { Directory, File, Paths } from 'expo-file-system';
import { applyPalette, GIFEncoder, quantize } from 'gifenc';
import * as pngSync from 'pngjs/lib/png-sync.js';

/** Options for {@link framesToGif}. */
export type FramesToGifOptions = {
  /** Delay per frame, in milliseconds (GIF's own unit is centiseconds — converted internally). */
  frameDelayMs: number;
  /** Frames are downscaled (nearest-neighbor) to this width if wider, keeping aspect ratio —
   * matches the rough size ballpark PhotoStoryTemplate's captured story images use, to keep the
   * animated version from being dramatically larger than the static equivalent. Default 480. */
  maxWidth?: number;
  /** Max palette size passed to gifenc's quantizer. Default 128 — halves typical palette-table
   * overhead vs. the default 256 with little visible difference for a flat-color map/route
   * graphic (as opposed to a photo), see gifenc's README on when its quantizer works best. */
  maxColors?: number;
};

const DEFAULT_MAX_WIDTH = 480;
const DEFAULT_MAX_COLORS = 128;

/** Decodes a series of already-captured PNG frame files (see RouteRevealMap's `captureFrames`)
 * and re-encodes them as a single animated GIF file, written to cache and returned as a
 * `file://` URI ready to hand to `uploadPostPhoto` (same as any other locally-captured photo).
 *
 * NOTE — not verified on-device: PNG decoding here goes through pngjs backed by a pako-based
 * `zlib` shim (see metro.config.js / polyfills/), which has not been exercised against real
 * captured map screenshots outside of static analysis. If this throws or silently produces a
 * garbled image, check that shim first.
 */
export async function framesToGif(frameUris: string[], options: FramesToGifOptions): Promise<string> {
  if (frameUris.length === 0) {
    throw new Error('framesToGif: at least one frame is required');
  }

  const maxWidth = options.maxWidth ?? DEFAULT_MAX_WIDTH;
  const maxColors = options.maxColors ?? DEFAULT_MAX_COLORS;
  const delayCentiseconds = Math.max(2, Math.round(options.frameDelayMs / 10));

  const decodedFrames = await Promise.all(
    frameUris.map(async (uri) => {
      const bytes = await new File(uri).bytes();
      const png = pngSync.read(Buffer.from(bytes));
      return downscaleRGBA(png.data, png.width, png.height, maxWidth);
    })
  );

  // A single shared palette (quantized from the LAST frame — the fully-revealed route, which
  // tends to have the widest color variety of the sequence) is applied to every frame, rather
  // than re-quantizing per frame, so colors stay consistent across the animation instead of
  // flickering/shifting frame to frame.
  const paletteSourceFrame = decodedFrames[decodedFrames.length - 1];
  const palette = quantize(paletteSourceFrame.data, maxColors);

  const gif = GIFEncoder();
  decodedFrames.forEach((frame, i) => {
    const index = applyPalette(frame.data, palette);
    gif.writeFrame(index, frame.width, frame.height, {
      palette,
      first: i === 0,
      delay: delayCentiseconds,
      repeat: 0,
    });
  });
  gif.finish();
  const gifBytes = gif.bytes();

  const outFile = new File(new Directory(Paths.cache), `route-reveal-${Date.now()}.gif`);
  outFile.create();
  outFile.write(gifBytes);
  return outFile.uri;
}

/** Nearest-neighbor downscale of a decoded PNG's RGBA buffer — pngjs has no resize step of its
 * own, and there's no image-resizing library installed for this pipeline (createStaticMapImage
 * captures at the map View's actual on-screen size, which for a full-screen reveal map is far
 * larger than any reasonable GIF should be). Nearest-neighbor rather than any interpolation
 * because it's a handful of lines with no extra dependency, and the source content (a flat-color
 * line-and-markers map, not a photo) hides the resulting aliasing well. */
function downscaleRGBA(data: Buffer, width: number, height: number, maxWidth: number): { data: Uint8Array; width: number; height: number } {
  if (width <= maxWidth) {
    return { data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength), width, height };
  }
  const scale = maxWidth / width;
  const outWidth = Math.max(1, Math.round(width * scale));
  const outHeight = Math.max(1, Math.round(height * scale));
  const out = new Uint8Array(outWidth * outHeight * 4);
  for (let y = 0; y < outHeight; y++) {
    const srcY = Math.min(height - 1, Math.floor(y / scale));
    for (let x = 0; x < outWidth; x++) {
      const srcX = Math.min(width - 1, Math.floor(x / scale));
      const srcIdx = (srcY * width + srcX) * 4;
      const dstIdx = (y * outWidth + x) * 4;
      out[dstIdx] = data[srcIdx];
      out[dstIdx + 1] = data[srcIdx + 1];
      out[dstIdx + 2] = data[srcIdx + 2];
      out[dstIdx + 3] = data[srcIdx + 3];
    }
  }
  return { data: out, width: outWidth, height: outHeight };
}
