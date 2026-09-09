const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web implementation loads a wa-sqlite WASM binary — Metro
// needs to treat .wasm as a resolvable asset for that import to work.
config.resolver.assetExts.push('wasm');

// --- Node core polyfills for pngjs (route-share animated-GIF export pipeline) ---
// pngjs decodes captured RouteRevealMap PNG frames into raw RGBA pixels (see
// modules/social/gifExport.ts) so they can be re-encoded into a GIF via gifenc. pngjs is a
// Node library and internally does bare `require("zlib")` / `require("assert")` /
// `require("util")` / `require("buffer")` — none of which exist as built-ins under
// Metro/Hermes. This maps those specifiers onto the pure-JS polyfill packages installed for
// this purpose (`pako` standing in for `zlib`, since Node's zlib is a native binding pako
// reimplements in JS — see polyfills/zlib-shim.js for exactly what pngjs needs from it).
// NOTE: deliberately NOT `require.resolve('assert')` / `require.resolve('util')` /
// `require.resolve('buffer')` — under plain Node (which is what evaluates this config file),
// `require.resolve` for a bare specifier that matches one of Node's own built-in module names
// resolves to that built-in FIRST, shadowing the same-named npm package in node_modules
// entirely (it returns the literal string "assert", not a file path) — so those calls would
// silently hand Metro the wrong thing. Pointing straight at each package's own `main` file
// sidesteps that shadowing.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  zlib: path.resolve(__dirname, 'polyfills/zlib-shim.js'),
  assert: path.resolve(__dirname, 'node_modules/assert/build/assert.js'),
  util: path.resolve(__dirname, 'node_modules/util/util.js'),
  buffer: path.resolve(__dirname, 'node_modules/buffer/index.js'),
};

// pngjs/lib/parser-sync.js also internally requires its own sibling module,
// `./sync-inflate`, to decode non-interlaced PNGs (the common case). That file doesn't just
// call `zlib.inflateSync` — it reimplements Node's *internal* streaming zlib.Inflate class,
// down to a native `_handle.writeSync(...)` binding, so old Node versions without
// `zlib.deflateSync` could still decode synchronously. pako has no equivalent for that
// internal binding (it only exposes the plain algorithm), so rather than try to faithfully
// emulate it, this redirects pngjs's own relative require to a small drop-in replacement that
// implements only the plain function signature pngjs actually calls. See
// polyfills/pngjs-sync-inflate-shim.js for the replacement and the full rationale.
const PNGJS_PARSER_SYNC = path.join('pngjs', 'lib', 'parser-sync.js');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === './sync-inflate' && context.originModulePath.endsWith(PNGJS_PARSER_SYNC)) {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'polyfills/pngjs-sync-inflate-shim.js'),
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
