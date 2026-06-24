export function formatTranscript(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .trim();
}
