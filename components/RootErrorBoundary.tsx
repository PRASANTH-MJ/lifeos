import { Component, type ReactNode } from 'react';
import { Platform, Pressable, Text, View, useColorScheme } from 'react-native';

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Wraps the entire app (outside ThemeProvider, since a crash here can happen before that even
 * mounts) so an uncaught render error shows a friendly recovery screen instead of React silently
 * unmounting to a blank white/black page. The concrete, reproducible case this was built for:
 * opening the web app in a second browser tab throws `NoModificationAllowedError` from
 * expo-sqlite's OPFS backend (`createSyncAccessHandle` only allows one open handle per database
 * file per browser), which — with no boundary — crashed straight to a blank screen with zero
 * explanation. Native/mobile doesn't hit this specific case, but the boundary is a reasonable
 * safety net there too. */
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) return <AppCrashScreen error={this.state.error} />;
    return this.props.children;
  }
}

const MULTI_TAB_CONFLICT_PATTERN = /createSyncAccessHandle|NoModificationAllowedError/i;

function AppCrashScreen({ error }: { error: Error }) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const background = isDark ? '#0B0D12' : '#F9FAFB';
  const textPrimary = isDark ? '#F5F6F8' : '#11131A';
  const textSecondary = isDark ? '#9AA3B2' : '#5B6270';
  const isMultiTabConflict = MULTI_TAB_CONFLICT_PATTERN.test(error.message);

  const reload = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.reload();
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: background, padding: 24, gap: 14 }}>
      <Text style={{ color: textPrimary, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
        {isMultiTabConflict ? 'Flowsy is already open in another tab' : 'Something went wrong'}
      </Text>
      <Text style={{ color: textSecondary, fontSize: 14, textAlign: 'center', maxWidth: 340, lineHeight: 20 }}>
        {isMultiTabConflict
          ? 'Flowsy can only be open in one tab at a time. Switch to that tab to keep using it there, or close it and reload this page.'
          : 'Please reload the page to continue. If this keeps happening, let us know from the other tab or device.'}
      </Text>
      {Platform.OS === 'web' ? (
        <Pressable
          onPress={reload}
          style={{ backgroundColor: '#4F46E5', paddingVertical: 12, paddingHorizontal: 28, borderRadius: 10, marginTop: 6 }}>
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Reload</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
