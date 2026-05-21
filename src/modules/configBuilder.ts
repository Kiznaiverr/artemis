import { ApiError } from "../http/apiError";
import { AppConfig } from "../types/config.types";

export interface CreatePeakJobBody {
  youtubeUrl?: unknown;
}

const ALLOWED_BODY_KEYS = new Set(["youtubeUrl"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readInteger(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      `${fieldName} must be an integer`,
    );
  }

  return value;
}

function readPositiveInteger(value: unknown, fieldName: string): number {
  const parsed = readInteger(value, fieldName);
  if (parsed <= 0) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      `${fieldName} must be greater than 0`,
    );
  }

  return parsed;
}

function readNonNegativeInteger(value: unknown, fieldName: string): number {
  const parsed = readInteger(value, fieldName);
  if (parsed < 0) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      `${fieldName} must be greater than or equal to 0`,
    );
  }

  return parsed;
}

function normalizeYoutubeUrl(rawValue: string): string {
  try {
    const url = new URL(rawValue);
    const hostname = url.hostname.replace(/^www\./, "");

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Invalid protocol");
    }

    if (hostname === "youtu.be" || hostname.endsWith("youtube.com")) {
      return rawValue;
    }
  } catch {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "youtubeUrl must be a valid YouTube URL",
    );
  }

  throw new ApiError(
    400,
    "VALIDATION_ERROR",
    "youtubeUrl must be a valid YouTube URL",
  );
}

export function buildConfigFromBody(
  baseConfig: AppConfig,
  body: unknown,
): AppConfig {
  if (!isRecord(body)) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "Request body must be a JSON object",
    );
  }

  for (const key of Object.keys(body)) {
    if (!ALLOWED_BODY_KEYS.has(key)) {
      throw new ApiError(400, "VALIDATION_ERROR", `Unexpected field: ${key}`);
    }
  }

  const rawYoutubeUrl = readString(body.youtubeUrl);
  if (!rawYoutubeUrl) {
    throw new ApiError(400, "VALIDATION_ERROR", "youtubeUrl is required");
  }

  return {
    ...baseConfig,
    videoUrl: normalizeYoutubeUrl(rawYoutubeUrl),
  };
}
