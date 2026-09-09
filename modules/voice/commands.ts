export type VoiceCommand = {
  key: string;
  /** Lowercase phrases; a transcript matches if it *contains* any of these, so phrasing like
   * "hey can you log water please" still hits "log water". */
  patterns: string[];
  confirmation: string;
  run: () => void | Promise<void>;
};

export function matchVoiceCommand(transcript: string, commands: VoiceCommand[]): VoiceCommand | null {
  const normalized = transcript.toLowerCase();
  return commands.find((command) => command.patterns.some((pattern) => normalized.includes(pattern))) ?? null;
}
