import { Alert, Platform } from 'react-native';

type AlertButton = {
  text?: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

/** Same call signature as RN's `Alert.alert(title, message?, buttons?)`, but actually works on
 * web — react-native-web's own `Alert.alert` is a complete no-op stub (does nothing at all,
 * confirmed by reading its source), which silently broke every delete/archive/restore
 * confirmation in the app on web with zero error or fallback. Native is untouched (delegates
 * straight to the real Alert.alert); web synthesizes the same behavior with
 * window.confirm/alert, mapping the non-cancel button as the "OK" branch. */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const list = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' } as AlertButton];
  const text = [title, message].filter(Boolean).join('\n\n');

  if (list.length === 1) {
    window.alert(text);
    list[0].onPress?.();
    return;
  }

  const cancelButton = list.find((b) => b.style === 'cancel');
  const confirmButton = list.find((b) => b.style !== 'cancel') ?? list[list.length - 1];
  if (window.confirm(text)) {
    confirmButton?.onPress?.();
  } else {
    cancelButton?.onPress?.();
  }
}
