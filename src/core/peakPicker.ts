import { AppConfig } from '../types/config.types';
import { ClipRange, PeakCandidate, TimeSeries } from '../types/peak.types';
import { formatMs } from '../utils/timeFormat';
import { logger } from '../utils/logger';
import { formatJobPrefix } from '../utils/jobLabel';

function isLocalMaximum(series: TimeSeries[], index: number): boolean {
  if (index <= 0 || index >= series.length - 1) {
    return false;
  }

  const current = series[index];
  const left = series[index - 1];
  const right = series[index + 1];

  return (
    current.normalizedScore > left.normalizedScore &&
    current.normalizedScore > right.normalizedScore
  );
}

function canAccept(candidate: PeakCandidate, accepted: PeakCandidate[], minGapMs: number): boolean {
  return accepted.every((peak) => Math.abs(peak.timestampMs - candidate.timestampMs) >= minGapMs);
}

function toSeconds(ms: number): number {
  return Math.floor(ms / 1000);
}

export function pickPeaks(series: TimeSeries[], config: AppConfig, alias?: string): ClipRange[] {
  if (series.length < 3) {
    return [];
  }

  const prefix = formatJobPrefix(alias);

  logger.info(`${prefix} picking peaks from ${series.length} normalized points`);

  const candidates = series
    .filter((_, index) => isLocalMaximum(series, index))
    .map((point) => ({
      timestampMs: point.timestampMs,
      normalizedScore: point.normalizedScore,
    }));

  candidates.sort((left, right) => right.normalizedScore - left.normalizedScore);

  logger.debug(`${prefix} local maxima candidates: ${candidates.length}`);

  const accepted: PeakCandidate[] = [];
  const minGapMs = config.peak.minGapSeconds * 1000;

  // Keep the strongest peaks while enforcing the minimum gap.
  for (const candidate of candidates) {
    if (accepted.length >= config.topN) {
      break;
    }

    if (canAccept(candidate, accepted, minGapMs)) {
      accepted.push(candidate);
      logger.debug(
        `${prefix} accepted peak at ${candidate.timestampMs} with score ${candidate.normalizedScore.toFixed(2)}`,
      );
    }
  }

  accepted.sort((left, right) => left.timestampMs - right.timestampMs);

  return accepted.map((peak, index) => {
    const startMs = Math.max(0, peak.timestampMs - config.clipPadding.before * 1000);
    const endMs = peak.timestampMs + config.clipPadding.after * 1000;

    return {
      peakIndex: index + 1,
      peakTimestampMs: peak.timestampMs,
      peakTimestampSec: toSeconds(peak.timestampMs),
      startMs,
      endMs,
      startSec: toSeconds(startMs),
      endSec: toSeconds(endMs),
      startFormatted: formatMs(startMs),
      endFormatted: formatMs(endMs),
      peakFormatted: formatMs(peak.timestampMs),
      normalizedScore: peak.normalizedScore,
    };
  });
}
