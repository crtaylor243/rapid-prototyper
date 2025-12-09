const MAX_TITLE_LENGTH = 48;

export function generatePromptTitle(promptText: string): string {
  const normalized = promptText.trim();
  if (!normalized) {
    return 'Untitled prompt';
  }

  if (normalized.length <= MAX_TITLE_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_TITLE_LENGTH - 3).trimEnd()}...`;
}
