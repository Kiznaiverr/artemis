import { AppConfig } from "../types/config.types";
import { RawComment, WeightedEvent } from "../types/comment.types";
import { logger } from "../utils/logger";

const DEFAULT_HYPE_KEYWORDS = [
  "gg",
  "ggg",
  "gggg",
  "lol",
  "lmao",
  "omg",
  "wow",
  "wtf",
  "haha",
  "hahaha",
  "ahaha",
  "ahahaha",
  "wkwk",
  "wkwkwk",
  "awkwoa",
  "anjir",
  "anjing",
  "gila",
  "gilak",
  "mantap",
  "mampus",
  "bocil",
  "gasss",
  "gass",
  "lets go",
  "lesgooo",
  "ez",
  "pog",
  "poggers",
  "keren",
  "seru",
  "woah",
  "woow",
];

function isUrlOnly(text: string): boolean {
  const urlPattern = /^(https?:\/\/|www\.)\S+$/i;
  return urlPattern.test(text.trim());
}

function hasHypeKeyword(text: string, keywords: string[]): boolean {
  const lowerText = text.toLowerCase();
  return keywords.some((keyword) => lowerText.includes(keyword.toLowerCase()));
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
  keywords: string[],
): number {
  let score = 1;

  if (config.filter.enabled && hasHypeKeyword(text, keywords)) {
    score += 0.5;
  }
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
  const keywords =
    config.filter.keywords.length > 0
      ? config.filter.keywords
      : DEFAULT_HYPE_KEYWORDS;

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

  logger.debug(`accepted comment at ${comment.timestampMs}`);

  const score = scoreText(text, config, keywords);

  logger.debug(
    `comment scored at ${comment.timestampMs} => ${score.toFixed(2)}`,
  );

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

  return comments
    .map((comment) => scoreComment(comment, config))
    .filter((event): event is WeightedEvent => event !== null);
}
