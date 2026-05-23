import { ClipRange } from './peak.types';

export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface JobResult {
  jobId: string;
  videoTitle: string;
  videoUrl: string;
  generatedAt: string;
  clips: ClipRange[];
  output: {
    topN: number;
    windowSize: number;
    minGapSeconds: number;
  };
}

export interface CompletedJobSummary {
  jobId: string;
  videoTitle: string;
  videoUrl: string;
  generatedAt: string;
  clipsCount: number;
  outputId: string;
  resultUrl: string;
  status: 'done';
}

export interface JobRecord {
  jobId: string;
  alias: string;
  videoTitle: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  resultPath: string;
  result?: JobResult;
  error?: string;
}
