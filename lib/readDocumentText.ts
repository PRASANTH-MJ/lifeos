import type { DocumentPickerAsset } from 'expo-document-picker';
import { Platform } from 'react-native';

/**
 * Reads a picked document's text content, on whichever platform picked it.
 *
 * expo-file-system's `File` class (the native "new File(uri).text()" pattern used everywhere
 * else in this app) supports ONLY Android/iOS/tvOS — it has no web implementation at all, so
 * every CSV/Excel import built against it (Finance Records, Shopping List, and later Habits/
 * Tasks) silently failed on web. expo-document-picker's own asset carries a real browser `File`
 * object (a completely different, unrelated `File` — the standard Web File API one) on web only
 * (`asset.file`), which has its own native `.text()` — that's the one to use there instead.
 */
export async function readDocumentText(asset: DocumentPickerAsset): Promise<string> {
  if (Platform.OS === 'web') {
    if (!asset.file) throw new Error('No file content available for this document on web.');
    return asset.file.text();
  }
  const { File } = await import('expo-file-system');
  return new File(asset.uri).text();
}
