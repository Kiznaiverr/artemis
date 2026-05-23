import { AppConfig } from '../types/config.types';
import { TimeSeries, WeightedEvent } from '../types';
import { logger } from '../utils/logger';
import { formatJobPrefix } from '../utils/jobLabel';

export function buildTimeSeries(
  events: WeightedEvent[],
  config: AppConfig,
  alias?: string,
): Omit<TimeSeries, 'normalizedScore'>[] {
  if (events.length === 0) {
    return [];
  }

  const sortedEvents = [...events].sort((left, right) => left.timestampMs - right.timestampMs);
  const minTimestamp = sortedEvents[0].timestampMs;
  const maxTimestamp = sortedEvents[sortedEvents.length - 1].timestampMs;
  const windowSizeMs = config.window.size * 1000;
  const stepMs = config.window.step * 1000;
  const halfWindow = windowSizeMs / 2;

  const prefix = formatJobPrefix(alias);

  logger.info(`${prefix} building time series with ${events.length} weighted events`);

  const series: Omit<TimeSeries, 'normalizedScore'>[] = [];
  let leftIndex = 0;
  let rightIndex = 0;
  let windowSum = 0;

  // Walk the timeline in fixed steps and score each window.
  for (let center = minTimestamp; center <= maxTimestamp; center += stepMs) {
    const startMs = center - halfWindow;
    const endMs = center + halfWindow;

    while (leftIndex < sortedEvents.length && sortedEvents[leftIndex].timestampMs < startMs) {
      windowSum -= sortedEvents[leftIndex].score;
      leftIndex += 1;
    }

    while (rightIndex < sortedEvents.length && sortedEvents[rightIndex].timestampMs <= endMs) {
      windowSum += sortedEvents[rightIndex].score;
      rightIndex += 1;
    }

    series.push({
      timestampMs: center,
      rawScore: windowSum,
    });
  }

  logger.info(`${prefix} built time series points: ${series.length}`);

  return series;
}
