import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useRef, useState } from 'react';

import { matchVoiceCommand, type VoiceCommand } from './commands';

const MAX_LISTEN_MS = 8000;
export const NO_MATCH_MESSAGE = "Sorry, I didn't catch a command";
export const PERMISSION_DENIED_MESSAGE = 'Microphone permission needed';

/** Wires expo-speech-recognition (on-device speech-to-text, same interface on native and web —
 * see the package's .web.ts) to a fixed set of commands, and speaks the result back via
 * expo-speech. No LLM/cloud calls: recognition happens on-device and matching is plain keyword
 * matching against `commands`. */
export function useVoiceCommands(commands: VoiceCommand[]) {
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearMaxListenTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useSpeechRecognitionEvent('start', () => setListening(true));

  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    clearMaxListenTimer();
  });

  useSpeechRecognitionEvent('result', (event) => {
    if (!event.isFinal) return;
    const transcript = event.results[0]?.transcript ?? '';
    const matched = matchVoiceCommand(transcript, commands);
    if (matched) {
      setStatus(matched.confirmation);
      Speech.speak(matched.confirmation);
      matched.run();
    } else {
      setStatus(NO_MATCH_MESSAGE);
      Speech.speak(NO_MATCH_MESSAGE);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    clearMaxListenTimer();
    setListening(false);
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      setStatus(PERMISSION_DENIED_MESSAGE);
      return;
    }
    setStatus(NO_MATCH_MESSAGE);
  });

  const start = useCallback(async () => {
    clearMaxListenTimer();
    setStatus(null);

    const existing = await ExpoSpeechRecognitionModule.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted) {
      const response = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      granted = response.granted;
    }
    // Denial fallback: no retry loop, no crash — just tell the user and stop here. They can grant
    // it later from device settings and tap the mic again.
    if (!granted) {
      setStatus(PERMISSION_DENIED_MESSAGE);
      return;
    }

    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: false });
    // Safety net on top of the module's own end-of-speech handling (non-continuous mode stops
    // itself on silence/a final result per ExpoSpeechRecognitionOptions.continuous) — this only
    // fires if that never happens.
    timeoutRef.current = setTimeout(() => ExpoSpeechRecognitionModule.stop(), MAX_LISTEN_MS);
  }, [commands]);

  return { listening, status, start };
}
