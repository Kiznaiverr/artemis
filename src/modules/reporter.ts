import { promises as fs } from 'fs';
import path from 'path';
import { AppConfig } from '../types/config.types';
import { ClipRange } from '../types/peak.types';
import { formatMs } from '../utils/timeFormat';
import { logger } from '../utils/logger';

function formatScore(value: number): string {
  return value.toFixed(2);
}

function buildTable(clips: ClipRange[], videoUrl: string): string {
  const separator = '─────────────────────────────────────────────────────';
  const header = `Peak Detection Results — video: ${videoUrl}`;
  const rows = clips.map((clip) => {
    const peakTime = formatMs(clip.peakTimestampMs).padEnd(8, ' ');
    const range = `${clip.startFormatted} → ${clip.endFormatted}`.padEnd(18, ' ');
    return ` ${String(clip.peakIndex).padStart(1, ' ')} │ ${peakTime} │ ${range} │ ${formatScore(clip.normalizedScore)}`;
  });

  return [
    header,
    separator,
    ' # │ Peak time │ Clip range        │ Score',
    separator,
    ...rows,
    separator,
  ].join('\n');
}

export async function report(clips: ClipRange[], config: AppConfig, alias?: string): Promise<void> {
  const outputDir = path.resolve(config.output.dir);
  await fs.mkdir(outputDir, { recursive: true });

  const prefix = alias ? `[${alias}]` : '[job]';

  logger.info(`${prefix} writing report for ${clips.length} peaks`);

  console.log(buildTable(clips, config.videoUrl));

  const outputPath = path.join(outputDir, config.output.filename);
  const payload = {
    videoUrl: config.videoUrl,
    generatedAt: new Date().toISOString(),
    config: {
      topN: config.topN,
      windowSize: config.window.size,
      minGapSeconds: config.peak.minGapSeconds,
    },
    peaks: clips.map((clip) => ({
      peakIndex: clip.peakIndex,
      peakFormatted: clip.peakFormatted,
      startFormatted: clip.startFormatted,
      endFormatted: clip.endFormatted,
      peakTimestampMs: clip.peakTimestampMs,
      peakTimestampSec: clip.peakTimestampSec,
      startMs: clip.startMs,
      startSec: clip.startSec,
      endMs: clip.endMs,
      endSec: clip.endSec,
      normalizedScore: clip.normalizedScore,
    })),
  };

  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  logger.debug(`${prefix} report written to ${outputPath}`);
}
