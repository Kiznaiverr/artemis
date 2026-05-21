import { AppConfig } from "../types/config.types";
import { JobResult } from "../types/job.types";
import { buildTimeSeries } from "../core/window";
import { normalize } from "../core/normalizer";
import { pickPeaks } from "../core/peakPicker";
import { fetchLiveChat } from "./fetcher";
import { logger } from "../utils/logger";

export async function runPeakPipeline(
  config: AppConfig,
  jobId: string,
): Promise<JobResult> {
  logger.info(`starting job: ${jobId}`);

  const events = await fetchLiveChat(config);

  const series = buildTimeSeries(events, config);

  const normalizedSeries = normalize(series, config);

  const clips = pickPeaks(normalizedSeries, config);
  logger.info(`selected peaks: ${clips.length}`);

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
