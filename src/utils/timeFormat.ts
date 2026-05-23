const pad = (value: number): string => String(value).padStart(2, '0');

export function formatMs(ms: number): string {
  const safeMs = Math.max(0, Math.floor(ms));
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function parseFormatted(value: string): number {
  const [minutesPart, secondsPart] = value.split(':');
  const minutes = Number(minutesPart);
  const seconds = Number(secondsPart);

  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    throw new Error(`Invalid formatted time: ${value}`);
  }

  return (minutes * 60 + seconds) * 1000;
}
