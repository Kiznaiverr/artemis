export function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

export function formatJsonValue(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function formatDebugJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('``')) {
    return trimmed;
  }

  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}
