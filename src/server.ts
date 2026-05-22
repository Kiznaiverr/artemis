import express, { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";
import { apiReference } from "@scalar/express-api-reference";
import { config as baseConfig } from "./config/constant";
import { ApiError, isApiError } from "./http/apiError";
import { openApiSpec } from "./http/openapi";
import { buildConfigFromBody } from "./modules/configBuilder";
import {
  enqueueJob,
  getJobRecord,
  startJobCleanupTimer,
} from "./modules/jobStore";
import { runPeakPipeline } from "./modules/pipeline";
import { httpLogger, logger } from "./utils/logger";

type JsonResponse = Record<string, unknown>;

function sendSuccess<T>(
  response: Response,
  data: T,
  statusCode = 200,
): Response {
  return response.status(statusCode).json({
    success: true,
    data,
  });
}

function sendError(
  response: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  const payload: JsonResponse = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (details !== undefined) {
    (payload.error as Record<string, unknown>).details = details;
  }

  return response.status(statusCode).json(payload);
}

function getOutputId(jobId: string): string {
  return `${jobId}.json`;
}

function readPathParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function getJobProgress(record: NonNullable<ReturnType<typeof getJobRecord>>) {
  switch (record.status) {
    case "queued":
      return {
        stage: "queued",
        message: "Job accepted and waiting in queue",
      };
    case "running":
      return {
        stage: "running",
        message: "Job is processing the YouTube URL",
      };
    case "done":
      return {
        stage: "done",
        message: "Job finished successfully",
      };
    case "failed":
      return {
        stage: "failed",
        message: record.error ?? "Job failed",
      };
  }
}

function handleAsyncRoute(
  handler: (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => Promise<void>,
) {
  return (request: Request, response: Response, next: NextFunction) => {
    void handler(request, response, next).catch(next);
  };
}

function isBodyParseError(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    typeof error === "object" &&
    error !== null &&
    "status" in error
  );
}

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.use((request, response, next) => {
    const startedAt = Date.now();

    response.on("finish", () => {
      httpLogger.info(
        `${request.method} ${request.originalUrl} -> ${response.statusCode} (${Date.now() - startedAt}ms)`,
      );
    });

    next();
  });

  app.get("/openapi.json", (_request, response) => {
    response.json(openApiSpec);
  });

  app.use(
    "/docs",
    apiReference({
      theme: "alternate",
      content: openApiSpec,
    }),
  );

  app.post(
    "/peaks",
    handleAsyncRoute(async (request, response) => {
      const jobId = `job-${randomUUID()}`;
      const jobConfig = buildConfigFromBody(baseConfig, request.body);
      const record = enqueueJob(jobId, jobConfig, runPeakPipeline);

      sendSuccess(
        response,
        {
          jobId: record.jobId,
          alias: record.alias,
          status: record.status,
          checkUrl: `/peaks/${record.jobId}`,
          resultUrl: `/peaks/${record.jobId}/result`,
        },
        201,
      );
    }),
  );

  app.get(
    "/peaks/:jobId",
    handleAsyncRoute(async (request, response) => {
      const jobId = readPathParam(request.params.jobId);
      const record = getJobRecord(jobId);

      if (!record) {
        throw new ApiError(404, "JOB_NOT_FOUND", "Job not found");
      }

      const payload: JsonResponse = {
        jobId: record.jobId,
        alias: record.alias,
        status: record.status,
        progress: getJobProgress(record),
      };

      if (record.status === "done") {
        payload.outputId = getOutputId(record.jobId);
        payload.resultUrl = `/peaks/${record.jobId}/result`;
      }

      if (record.status === "failed" && record.error) {
        payload.error = record.error;
      }

      sendSuccess(response, payload);
    }),
  );

  app.get(
    "/peaks/:jobId/result",
    handleAsyncRoute(async (request, response) => {
      const jobId = readPathParam(request.params.jobId);
      const record = getJobRecord(jobId);

      if (!record) {
        throw new ApiError(404, "JOB_NOT_FOUND", "Job not found");
      }

      if (record.status === "failed") {
        throw new ApiError(409, "JOB_FAILED", record.error ?? "Job failed");
      }

      if (record.status !== "done" || !record.result) {
        throw new ApiError(409, "JOB_NOT_READY", "Job is not finished yet");
      }

      sendSuccess(response, {
        ...record.result,
        outputId: getOutputId(record.jobId),
      });
    }),
  );

  app.use((_request, _response, next) => {
    next(new ApiError(404, "NOT_FOUND", "Route not found"));
  });

  app.use(
    (
      error: unknown,
      _request: Request,
      response: Response,
      _next: NextFunction,
    ) => {
      if (isApiError(error)) {
        logger.warn(`${error.code}: ${error.message}`);
        sendError(
          response,
          error.statusCode,
          error.code,
          error.message,
          error.details,
        );
        return;
      }

      if (isBodyParseError(error)) {
        sendError(
          response,
          400,
          "INVALID_JSON",
          "Request body must be valid JSON",
        );
        return;
      }

      const message = error instanceof Error ? error.message : String(error);
      logger.error(message);
      sendError(
        response,
        500,
        "INTERNAL_SERVER_ERROR",
        "Internal server error",
      );
    },
  );

  return app;
}

export function startServer(port = Number(process.env.PORT ?? 3000)): void {
  startJobCleanupTimer();

  const app = createApp();
  app.listen(port, () => {
    logger.info(`server listening on http://localhost:${port}`);
  });
}
