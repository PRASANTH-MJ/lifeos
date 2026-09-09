// modules/social/gifExport.ts deep-imports `pngjs/lib/png-sync.js` directly (rather than the
// `pngjs` package's main entry, `lib/png.js`) specifically to avoid pulling in Node's `stream`
// module — `png.js` requires `stream`/`util` unconditionally at the top for its async
// Transform-stream API, which has no Metro/Hermes polyfill installed (only zlib/assert/util/
// buffer are — see metro.config.js). The synchronous decode-only path used here
// (`pngjs/lib/parser-sync.js`, reached via this file) never touches `stream` at all. pngjs ships
// no types for this deep path (its main `pngjs` package also has none — see @types check), so
// this covers only the one call this codebase makes: `PNGSync.read(buffer)`.
declare module 'pngjs/lib/png-sync.js' {
  import type { Buffer } from 'buffer';

  export interface DecodedPNG {
    width: number;
    height: number;
    /** Raw RGBA pixel data, 4 bytes/pixel, row-major. */
    data: Buffer;
    gamma: number;
  }

  export function read(buffer: Buffer, options?: { checkCRC?: boolean; skipRescale?: boolean }): DecodedPNG;
  export function write(
    png: { width: number; height: number; data: Uint8Array | Buffer; gamma?: number },
    options?: Record<string, unknown>
  ): Buffer;
}
