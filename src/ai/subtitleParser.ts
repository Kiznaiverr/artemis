import fs from 'fs/promises';
import path from 'path';
import { SubtitleSegment } from './types';
import { logger } from '../utils/logger';

function parseTimestampToMs(rawValue: string): number | undefined {
  const trimmed = rawValue.trim().replace(',', '.');
  const match = trimmed.match(/^(?:(\d+):)?(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!match) {
    return undefined;
  }

  const hours = Number(match[1] ?? '0');
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const milliseconds = Number((match[4] ?? '0').padEnd(3, '0'));

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    Number.isNaN(seconds) ||
    Number.isNaN(milliseconds)
  ) {
    return undefined;
  }

  return ((hours * 60 + minutes) * 60 + seconds) * 1000 + milliseconds;
}

function parseCueRange(line: string): { startMs: number; endMs: number } | undefined {
  const separatorIndex = line.indexOf('-->');
  if (separatorIndex === -1) {
    return undefined;
  }

  const startRaw = line.slice(0, separatorIndex).trim();
  const endRaw = line
    .slice(separatorIndex + 3)
    .trim()
    .split(/\s+/)[0];

  const startMs = parseTimestampToMs(startRaw);
  const endMs = parseTimestampToMs(endRaw);

  if (startMs === undefined || endMs === undefined || endMs <= startMs) {
    return undefined;
  }

  return { startMs, endMs };
}

export function parseSubtitleText(text: string): SubtitleSegment[] {
  const segments: SubtitleSegment[] = [];
  const lines = text.split(/\r?\n/);

  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line || line === 'WEBVTT') {
      index += 1;
      continue;
    }

    const cueRange = parseCueRange(line);
    if (!cueRange) {
      index += 1;
      continue;
    }

    index += 1;
    const cueLines: string[] = [];

    while (index < lines.length) {
      const cueLine = lines[index].trim();
      if (!cueLine) {
        break;
      }

      cueLines.push(cueLine);
      index += 1;
    }

    const cueText = cueLines
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (cueText) {
      segments.push({
        startMs: cueRange.startMs,
        endMs: cueRange.endMs,
        text: cueText,
      });
    }

    index += 1;
  }

  return segments;
}

export async function loadBestSubtitleSegments(
  outputDir: string,
  alias?: string,
): Promise<SubtitleSegment[] | undefined> {
  const entries = await fs.readdir(outputDir);
  const subtitleFiles = entries.filter((file) => {
    return /\.(vtt|srt)$/i.test(file) && !file.includes('live_chat');
  });

  if (subtitleFiles.length === 0) {
    return undefined;
  }

  let bestSegments: SubtitleSegment[] | undefined;
  let bestFile: string | undefined;

  for (const file of subtitleFiles) {
    const filePath = path.join(outputDir, file);

    let rawText: string;
    try {
      rawText = await fs.readFile(filePath, 'utf8');
    } catch {
      continue;
    }

    const segments = parseSubtitleText(rawText);
    if (segments.length === 0) {
      continue;
    }

    if (!bestSegments || segments.length > bestSegments.length) {
      bestSegments = segments;
      bestFile = file;
    }
  }

  if (alias && bestSegments && bestFile) {
    logger.debug(`[${alias}] subtitle track selected: ${bestFile} (${bestSegments.length} cues)`);
  }

  return bestSegments;
}
