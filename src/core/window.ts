import { AppConfig } from "../types/config.types";
import { TimeSeries, WeightedEvent } from "../types";
import { logger } from "../utils/logger";

function sumScores(
  events: WeightedEvent[],
  startMs: number,
  endMs: number,
): number {
  let total = 0;
  for (const event of events) {
    if (event.timestampMs >= startMs && event.timestampMs <= endMs) {
      total += event.score;
    }
  }
  return total;
}

export function buildTimeSeries(
  events: WeightedEvent[],
  config: AppConfig,
): Omit<TimeSeries, "normalizedScore">[] {
  if (events.length === 0) {
    return [];
  }

  const sortedEvents = [...events].sort(
    (left, right) => left.timestampMs - right.timestampMs,
  );
  const minTimestamp = sortedEvents[0].timestampMs;
  const maxTimestamp = sortedEvents[sortedEvents.length - 1].timestampMs;
  const windowSizeMs = config.window.size * 1000;
  const stepMs = config.window.step * 1000;
  const halfWindow = windowSizeMs / 2;

  logger.info(`building time series with ${events.length} weighted events`);

  const series: Omit<TimeSeries, "normalizedScore">[] = [];
  // Walk the timeline in fixed steps and score each window.
  for (let center = minTimestamp; center <= maxTimestamp; center += stepMs) {
    const rawScore = sumScores(
      sortedEvents,
      center - halfWindow,
      center + halfWindow,
    );

    logger.debug(`window center ${center} scored ${rawScore.toFixed(2)}`);

    series.push({
      timestampMs: center,
      rawScore,
    });
  }

  return series;
}
