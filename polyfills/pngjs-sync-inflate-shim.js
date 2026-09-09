// Drop-in replacement for pngjs's lib/sync-inflate.js — see metro.config.js's
// `resolver.resolveRequest` override (which redirects pngjs/lib/parser-sync.js's internal
// `require("./sync-inflate")` here) and polyfills/zlib-shim.js's header comment for the full
// explanation of why: the real sync-inflate.js reimplements Node's internal streaming
// zlib.Inflate class (including a native `_handle.writeSync` binding) purely so old Node
// versions without `zlib.deflateSync` could still decode PNGs synchronously. There's no
// Metro/Hermes equivalent of that binding, and pako doesn't expose one either.
//
// pngjs's lib/parser-sync.js only ever uses this module's default export as a plain function,
// called as `inflateSync(buffer, { chunkSize, maxLength })` and expected to return a Buffer of
// the fully-inflated data (see node_modules/pngjs/lib/parser-sync.js) — none of the exported
// `.Inflate` / `.createInflate` extras on the real module are used anywhere else in pngjs, so
// this only needs to satisfy that one call shape.
const pako = require('pako');

module.exports = function inflateSync(buffer, opts) {
  const out = Buffer.from(pako.inflate(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)));
  if (opts && typeof opts.maxLength === 'number' && out.length > opts.maxLength) {
    return out.subarray(0, opts.maxLength);
  }
  return out;
};
