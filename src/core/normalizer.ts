import { AppConfig } from '../types/config.types';
import { TimeSeries } from '../types/peak.types';
import { logger } from '../utils/logger';
import { formatJobPrefix } from '../utils/jobLabel';

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

export function normalize(
  series: Omit<TimeSeries, 'normalizedScore'>[],
  _config: AppConfig,
  alias?: string,
): TimeSeries[] {
  if (series.length === 0) {
    return [];
  }

  const globalMean = mean(series.map((point) => point.rawScore));
  const baselineWindowMs = 5 * 60 * 1000;
  const rawScores = series.map((point) => point.rawScore);
  const timestamps = series.map((point) => point.timestampMs);

  const prefix = formatJobPrefix(alias);

  logger.info(`${prefix} normalizing ${series.length} series points`);

  let leftIndex = 0;
  let rightIndex = -1;
  let windowSum = 0;

  const normalizedSeries = series.map((point) => {
    // Use a nearby baseline when enough windows are available.
    const windowStart = point.timestampMs - baselineWindowMs;
    const windowEnd = point.timestampMs + baselineWindowMs;

    while (rightIndex + 1 < series.length && timestamps[rightIndex + 1] <= windowEnd) {
      rightIndex += 1;
      windowSum += rawScores[rightIndex];
    }

    while (leftIndex < series.length && timestamps[leftIndex] < windowStart) {
      windowSum -= rawScores[leftIndex];
      leftIndex += 1;
    }

    const neighboringCount = rightIndex >= leftIndex ? rightIndex - leftIndex + 1 : 0;
    const baseline = neighboringCount >= 3 ? windowSum / neighboringCount : globalMean;
    const normalizedScore = baseline === 0 ? 0 : point.rawScore / baseline;

    // uncomment this for detailed normalization logs
    // logger.debug(
    //   `${prefix} normalized point ${point.timestampMs}: raw=${point.rawScore.toFixed(2)} baseline=${baseline.toFixed(2)} score=${normalizedScore.toFixed(2)}`,
    // );

    return {
      ...point,
      normalizedScore,
    };
  });

  logger.info(`${prefix} normalized series points: ${normalizedSeries.length}`);

  return normalizedSeries;
}
