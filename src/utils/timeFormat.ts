const pad = (value: number): string => String(value).padStart(2, '0');

export function formatMs(ms: number): string {
  const safeMs = Math.max(0, Math.floor(ms));
  const totalSeconds = Math.floor(safeMs / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (totalMinutes < 60) {
    return `${pad(totalMinutes)}:${pad(seconds)}`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${pad(hours)}.${pad(minutes)}.${pad(seconds)}`;
}

export function parseFormatted(value: string): number {
  const parts = value.includes('.') ? value.split('.') : value.split(':');

  if (parts.length === 2) {
    const [minutesPart, secondsPart] = parts;
    const minutes = Number(minutesPart);
    const seconds = Number(secondsPart);

    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
      throw new Error(`Invalid formatted time: ${value}`);
    }

    return (minutes * 60 + seconds) * 1000;
  }

  if (parts.length === 3) {
    const [hoursPart, minutesPart, secondsPart] = parts;
    const hours = Number(hoursPart);
    const minutes = Number(minutesPart);
    const seconds = Number(secondsPart);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
      throw new Error(`Invalid formatted time: ${value}`);
    }

    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  }

  throw new Error(`Invalid formatted time: ${value}`);
}
