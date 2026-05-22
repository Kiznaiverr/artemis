import { AppConfig } from "../types/config.types";
import { JobResult } from "../types/job.types";
import { buildTimeSeries } from "../core/window";
import { normalize } from "../core/normalizer";
import { pickPeaks } from "../core/peakPicker";
import { fetchLiveChat } from "./fetcher";
import { logger } from "../utils/logger";

function jobPrefix(alias?: string): string {
  return alias ? `[${alias}]` : "[job]";
}

export async function runPeakPipeline(
  config: AppConfig,
  jobId: string,
  alias?: string,
): Promise<JobResult> {
  const prefix = jobPrefix(alias);

  logger.info(`${prefix} starting job`);

  const events = await fetchLiveChat(config, alias);

  const series = buildTimeSeries(events, config, alias);

  const normalizedSeries = normalize(series, config, alias);

  const clips = pickPeaks(normalizedSeries, config, alias);
  logger.info(`${prefix} selected peaks: ${clips.length}`);

  return {
    jobId,
    videoUrl: config.videoUrl,
    generatedAt: new Date().toISOString(),
    clips,
    output: {
      topN: config.topN,
      windowSize: config.window.size,
      minGapSeconds: config.peak.minGapSeconds,
    },
  };
}
