import { AppConfig } from '../types/config.types';
import { JobResult } from '../types/job.types';
import { buildTimeSeries } from '../core/window';
import { normalize } from '../core/normalizer';
import { pickPeaks } from '../core/peakPicker';
import { fetchLiveChat } from './fetcher';
import { logger } from '../utils/logger';
import { rerankPeakClips } from '../ai/peakRanker';
import { formatJobPrefix } from '../utils/jobLabel';

export async function runPeakPipeline(
  config: AppConfig,
  jobId: string,
  alias?: string,
): Promise<JobResult> {
  const prefix = formatJobPrefix(alias);

  logger.info(`${prefix} starting job`);

  const liveChat = await fetchLiveChat(config, alias);

  const series = buildTimeSeries(liveChat.events, config, alias);

  const normalizedSeries = normalize(series, config, alias);

  const candidateLimit = Math.max(config.topN, 20);
  const heuristicClips = pickPeaks(
    normalizedSeries,
    {
      ...config,
      topN: candidateLimit,
    },
    alias,
  );

  const clips = await rerankPeakClips(
    heuristicClips,
    liveChat.comments,
    liveChat.subtitleSegments,
    config,
    alias,
  );

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
