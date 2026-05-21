import { AppConfig } from "../types/config.types";
import { TimeSeries } from "../types/peak.types";
import { logger } from "../utils/logger";

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

export function normalize(
  series: Omit<TimeSeries, "normalizedScore">[],
  _config: AppConfig,
): TimeSeries[] {
  if (series.length === 0) {
    return [];
  }

  const globalMean = mean(series.map((point) => point.rawScore));
  const baselineWindowMs = 5 * 60 * 1000;

  logger.info(`normalizing ${series.length} series points`);

  const normalizedSeries = series.map((point) => {
    // Use a nearby baseline when enough windows are available.
    const neighboringScores = series
      .filter(
        (candidate) =>
          Math.abs(candidate.timestampMs - point.timestampMs) <=
          baselineWindowMs,
      )
      .map((candidate) => candidate.rawScore);

    const baseline =
      neighboringScores.length >= 3 ? mean(neighboringScores) : globalMean;
    const normalizedScore = baseline === 0 ? 0 : point.rawScore / baseline;

    logger.debug(
      `normalized point ${point.timestampMs}: raw=${point.rawScore.toFixed(2)} baseline=${baseline.toFixed(2)} score=${normalizedScore.toFixed(2)}`,
    );

    return {
      ...point,
      normalizedScore,
    };
  });

  logger.info(`normalized series points: ${normalizedSeries.length}`);

  return normalizedSeries;
}
