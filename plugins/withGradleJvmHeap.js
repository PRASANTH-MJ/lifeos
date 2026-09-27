const { withGradleProperties } = require('@expo/config-plugins');

// The default org.gradle.jvmargs (-Xmx2048m) the RN/Expo template writes into android/gradle.properties
// is too small for R8 to whole-program-analyze a release build of this size (many native modules —
// MapLibre, react-native-iap, Notifee, Reanimated, expo-speech-recognition, etc.) once
// enableMinifyInReleaseBuilds is turned on (see app.json's expo-build-properties config) — confirmed via
// a real local build that failed with "R8: java.lang.OutOfMemoryError: Java heap space" on
// :app:minifyReleaseWithR8 at the default heap size. expo-build-properties has no option for this (it
// only covers Android Gradle Plugin/AGP-level build.gradle settings, not the Gradle daemon's own JVM
// args), so this is a small standalone config plugin instead — same pattern Expo's own docs recommend
// for anything not covered by expo-build-properties. android/gradle.properties is regenerated fresh on
// every prebuild/EAS build (gitignored, not committed), so this can't be a one-off hand-edit; it has to
// run as a plugin every time to persist.
// Kept moderate (not maxed out) deliberately — this build machine only has 8GB total RAM and is
// already running tight (verified via `top`: ~67MB truly free, ~3.5GB in the memory compressor,
// even before a build starts). A much larger heap (e.g. 6GB+) risks trading an R8 OutOfMemoryError
// for system-wide swap thrashing instead, which is a slower, harder-to-diagnose failure mode. 4096m
// roughly doubles the previous default (2048m) — start here and raise it only if this alone doesn't
// clear the R8 OutOfMemoryError.
const JVM_ARGS = '-Xmx4096m -XX:MaxMetaspaceSize=768m -XX:+HeapDumpOnOutOfMemoryError';

module.exports = function withGradleJvmHeap(config) {
  return withGradleProperties(config, (config) => {
    const key = 'org.gradle.jvmargs';
    const existing = config.modResults.find((item) => item.type === 'property' && item.key === key);
    if (existing) {
      existing.value = JVM_ARGS;
    } else {
      config.modResults.push({ type: 'property', key, value: JVM_ARGS });
    }
    return config;
  });
};
