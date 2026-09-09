// Minimal `zlib` polyfill for Metro/Hermes (no native zlib binding exists in this environment).
//
// This exists solely to satisfy pngjs (components/RouteRevealMap.tsx's GIF-export pipeline
// decodes captured PNG frames via `PNG.sync.read`, which is pngjs). pngjs's
// lib/parser-sync.js and lib/packer-sync.js each do a plain `require("zlib")` and only ever
// call `zlib.deflateSync` / `zlib.inflateSync` — this shim backs those with `pako` (a pure-JS
// port of zlib's actual inflate/deflate algorithm), which is enough for both.
//
// What this deliberately does NOT attempt: pngjs's lib/sync-inflate.js — required internally by
// parser-sync.js for the (common, non-interlaced) PNG decode path — reimplements Node's
// *internal* streaming zlib.Inflate class, down to calling a native `_handle.writeSync(...)`
// binding. That's not part of Node's public zlib API and pako has no equivalent for it (pako
// only exposes the plain algorithm, not a fake native handle). Rather than emulate that
// internal machinery, metro.config.js's `resolver.resolveRequest` redirects pngjs's own
// `require("./sync-inflate")` straight to polyfills/pngjs-sync-inflate-shim.js, which
// implements only the plain function signature pngjs actually calls. This file only needs to
// cover the `zlib.inflateSync` call parser-sync.js makes directly for *interlaced* PNGs, plus
// the `deflateSync` truthiness check both files do at load time (and the packer-sync.js encode
// path, unused by this app's decode-only usage but implemented for completeness/safety).
const pako = require('pako');

function toUint8Array(data) {
  if (data instanceof Uint8Array) return data;
  // Buffer (from the `buffer` polyfill) is already a Uint8Array subclass, but guard for plain
  // arrays / array-likes too.
  return new Uint8Array(data);
}

function inflateSync(data) {
  return Buffer.from(pako.inflate(toUint8Array(data)));
}

function deflateSync(data, opts) {
  const level = opts && typeof opts.level === 'number' ? opts.level : undefined;
  return Buffer.from(pako.deflate(toUint8Array(data), level != null ? { level } : undefined));
}

module.exports = {
  inflateSync,
  deflateSync,
};
