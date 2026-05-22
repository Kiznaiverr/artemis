import { AppConfig } from "../types/config.types";
import { RawComment, WeightedEvent } from "../types/comment.types";
import { logger } from "../utils/logger";

function isUrlOnly(text: string): boolean {
  const urlPattern = /^(https?:\/\/|www\.)\S+$/i;
  return urlPattern.test(text.trim());
}

function hasAllCapsWord(text: string): boolean {
  return /\b[A-Z0-9]{3,}\b/.test(text);
}

function hasRepeatedRun(text: string): boolean {
  return /(.)\1{2,}|(?:ha){2,}|(?:wk){2,}|!{3,}/i.test(text);
}

function clampScore(score: number): number {
  return Math.min(score, 4);
}

function scoreText(
  text: string,
  config: AppConfig,
): number {
  let score = 1;

  if (hasAllCapsWord(text)) {
    score += 0.5;
  }
  if (hasRepeatedRun(text)) {
    score += 0.5;
  }
  if (text.trim().length >= 20) {
    score += 0.2;
  }

  return clampScore(score);
}

export function scoreComment(
  comment: RawComment,
  config: AppConfig,
): WeightedEvent | null {
  const text = comment.text.trim();
  if (text.length < config.filter.minLength) {
    return null;
  }
  if (text.length === 0) {
    return null;
  }
  if (isUrlOnly(text)) {
    return null;
  }

  const score = scoreText(text, config);

  return {
    timestampMs: comment.timestampMs,
    score,
  };
}

export function parseComments(
  comments: RawComment[],
  config: AppConfig,
): WeightedEvent[] {
  logger.info(`parsing comments: ${comments.length}`);
  const events = comments
    .map((comment) => scoreComment(comment, config))
    .filter((event): event is WeightedEvent => event !== null);

  logger.info(
    `parsed comments: ${comments.length}, accepted: ${events.length}`,
  );

  return events;
}
