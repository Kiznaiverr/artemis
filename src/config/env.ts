export function getEnvString(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

export function getEnvNumber(key: string, fallback: number): number {
  const rawValue = process.env[key];
  if (rawValue === undefined || rawValue.trim() === '') {
    return fallback;
  }

  const parsedValue = Number(rawValue);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

export function getPositiveEnvNumber(key: string, fallback: number): number {
  const value = getEnvNumber(key, fallback);
  return value > 0 ? value : fallback;
}
