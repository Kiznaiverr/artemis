import fs from 'fs';
import path from 'path';
import { AppConfig } from '../types/config.types';
import { CompletedJobSummary, JobRecord, JobResult, JobStatus } from '../types/job.types';
import { buildJobResultUrl } from '../utils/jobLabel';

const JOB_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const JOB_RESULTS_DIR = path.resolve('output/jobs');
const CLEANUP_INTERVAL_MS = 60 * 1000;

type JobHandler = (
  config: AppConfig,
  jobId: string,
  alias: string,
  videoTitle: string,
) => Promise<JobResult>;

interface QueuedJob {
  jobId: string;
  alias: string;
  videoTitle: string;
  config: AppConfig;
  handler: JobHandler;
}

const jobs = new Map<string, JobRecord>();
const queue: QueuedJob[] = [];
let isWorkerRunning = false;
let cleanupTimer: ReturnType<typeof setInterval> | undefined;
let nextJobAliasNumber = 1;

function nowIso(): string {
  return new Date().toISOString();
}

function createJobAlias(): string {
  const alias = `J${nextJobAliasNumber}`;
  nextJobAliasNumber += 1;
  return alias;
}

function buildResultPath(jobId: string): string {
  return path.join(JOB_RESULTS_DIR, `${jobId}.json`);
}

function buildRecord(jobId: string, alias: string, videoTitle: string): JobRecord {
  const createdAt = nowIso();
  return {
    jobId,
    alias,
    videoTitle,
    status: 'queued',
    createdAt,
    updatedAt: createdAt,
    expiresAt: new Date(Date.now() + JOB_TTL_MS).toISOString(),
    resultPath: buildResultPath(jobId),
  };
}

function writeResultFile(resultPath: string, payload: JobResult): void {
  fs.mkdirSync(path.dirname(resultPath), { recursive: true });
  fs.writeFileSync(resultPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function deleteResultFile(resultPath: string): void {
  if (fs.existsSync(resultPath)) {
    fs.unlinkSync(resultPath);
  }
}

function updateRecord(jobId: string, status: JobStatus, error?: string): void {
  const record = jobs.get(jobId);
  if (!record) {
    return;
  }

  record.status = status;
  record.updatedAt = nowIso();
  if (error) {
    record.error = error;
  }
}

function saveRecordResult(jobId: string, result: JobResult): JobRecord | undefined {
  const record = jobs.get(jobId);
  if (!record) {
    return undefined;
  }

  record.videoTitle = result.videoTitle;
  record.result = result;
  record.status = 'done';
  record.updatedAt = nowIso();
  writeResultFile(record.resultPath, result);
  return record;
}

function failRecord(jobId: string, error: string): void {
  updateRecord(jobId, 'failed', error);
}

export function getJobRecord(jobId: string): JobRecord | undefined {
  return jobs.get(jobId);
}

function buildCompletedJobSummary(result: JobResult, filePath: string): CompletedJobSummary {
  return {
    jobId: result.jobId,
    videoTitle: result.videoTitle,
    videoUrl: result.videoUrl,
    generatedAt: result.generatedAt,
    clipsCount: result.clips.length,
    outputId: path.basename(filePath),
    resultUrl: buildJobResultUrl(result.jobId),
    status: 'done',
  };
}

export function listCompletedJobs(): CompletedJobSummary[] {
  if (!fs.existsSync(JOB_RESULTS_DIR)) {
    return [];
  }

  const files = fs
    .readdirSync(JOB_RESULTS_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const filePath = path.join(JOB_RESULTS_DIR, file);
      const stat = fs.statSync(filePath);
      return { filePath, mtimeMs: stat.mtimeMs };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  const summaries: CompletedJobSummary[] = [];

  for (const file of files) {
    try {
      const rawText = fs.readFileSync(file.filePath, 'utf8');
      const result = JSON.parse(rawText) as JobResult;
      const videoTitle =
        typeof result.videoTitle === 'string' && result.videoTitle.trim()
          ? result.videoTitle.trim()
          : 'Unknown title';

      if (
        !result.jobId ||
        !result.videoUrl ||
        !result.generatedAt ||
        !Array.isArray(result.clips)
      ) {
        continue;
      }

      summaries.push(
        buildCompletedJobSummary(
          {
            ...result,
            videoTitle,
          },
          file.filePath,
        ),
      );
    } catch {
      continue;
    }
  }

  return summaries;
}

export function cleanupExpiredJobs(): void {
  const now = Date.now();

  for (const [jobId, record] of jobs.entries()) {
    if (Date.parse(record.expiresAt) > now) {
      continue;
    }

    deleteResultFile(record.resultPath);
    jobs.delete(jobId);
  }
}

export function startJobCleanupTimer(): void {
  if (cleanupTimer) {
    return;
  }

  cleanupTimer = setInterval(cleanupExpiredJobs, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();
}

async function drainQueue(): Promise<void> {
  if (isWorkerRunning) {
    return;
  }

  isWorkerRunning = true;

  try {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) {
        continue;
      }

      if (!jobs.has(next.jobId)) {
        continue;
      }

      updateRecord(next.jobId, 'running');

      try {
        const result = await next.handler(next.config, next.jobId, next.alias, next.videoTitle);
        const saved = saveRecordResult(next.jobId, result);
        if (!saved) {
          continue;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failRecord(next.jobId, message);
      }
    }
  } finally {
    isWorkerRunning = false;
  }
}

export function enqueueJob(
  jobId: string,
  config: AppConfig,
  videoTitle: string,
  handler: JobHandler,
): JobRecord {
  const alias = createJobAlias();
  jobs.set(jobId, buildRecord(jobId, alias, videoTitle));
  startJobCleanupTimer();

  queue.push({
    jobId,
    alias,
    videoTitle,
    config,
    handler,
  });

  void drainQueue();

  return jobs.get(jobId) as JobRecord;
}
