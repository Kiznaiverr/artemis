import { ClipRange } from "./peak.types";

export type JobStatus = "queued" | "running" | "done" | "failed";

export interface JobResult {
  jobId: string;
  videoUrl: string;
  generatedAt: string;
  clips: ClipRange[];
  output: {
    topN: number;
    windowSize: number;
    minGapSeconds: number;
  };
}

export interface JobRecord {
  jobId: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  resultPath: string;
  result?: JobResult;
  error?: string;
}
