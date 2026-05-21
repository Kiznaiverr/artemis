import fs from "fs";
import path from "path";
import { AppConfig } from "../types/config.types";
import { JobRecord, JobResult, JobStatus } from "../types/job.types";

const JOB_TTL_MS = 60 * 60 * 1000;
const JOB_RESULTS_DIR = path.resolve("output/jobs");
const CLEANUP_INTERVAL_MS = 60 * 1000;

type JobHandler = (config: AppConfig, jobId: string) => Promise<JobResult>;

interface QueuedJob {
  jobId: string;
  config: AppConfig;
  handler: JobHandler;
}

const jobs = new Map<string, JobRecord>();
const queue: QueuedJob[] = [];
let isWorkerRunning = false;
let cleanupTimer: NodeJS.Timeout | undefined;

function nowIso(): string {
  return new Date().toISOString();
}

function buildResultPath(jobId: string): string {
  return path.join(JOB_RESULTS_DIR, `${jobId}.json`);
}

function buildRecord(jobId: string): JobRecord {
  const createdAt = nowIso();
  return {
    jobId,
    status: "queued",
    createdAt,
    updatedAt: createdAt,
    expiresAt: new Date(Date.now() + JOB_TTL_MS).toISOString(),
    resultPath: buildResultPath(jobId),
  };
}

function writeResultFile(resultPath: string, payload: JobResult): void {
  fs.mkdirSync(path.dirname(resultPath), { recursive: true });
  fs.writeFileSync(resultPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
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

function saveRecordResult(
  jobId: string,
  result: JobResult,
): JobRecord | undefined {
  const record = jobs.get(jobId);
  if (!record) {
    return undefined;
  }

  record.result = result;
  record.status = "done";
  record.updatedAt = nowIso();
  writeResultFile(record.resultPath, result);
  return record;
}

function failRecord(jobId: string, error: string): void {
  updateRecord(jobId, "failed", error);
}

export function getJobRecord(jobId: string): JobRecord | undefined {
  return jobs.get(jobId);
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

      updateRecord(next.jobId, "running");

      try {
        const result = await next.handler(next.config, next.jobId);
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
  handler: JobHandler,
): JobRecord {
  jobs.set(jobId, buildRecord(jobId));
  startJobCleanupTimer();

  queue.push({
    jobId,
    config,
    handler,
  });

  void drainQueue();

  return jobs.get(jobId) as JobRecord;
}

export function purgeAllJobFiles(): void {
  for (const record of jobs.values()) {
    deleteResultFile(record.resultPath);
  }

  jobs.clear();
  queue.length = 0;

  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = undefined;
  }
}
