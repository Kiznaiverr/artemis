import { RawComment } from "../types/comment.types";
import { ClipRange } from "../types/peak.types";
import { PeakContextCandidate, SubtitleSegment } from "./types";

function normalizeComments(comments: RawComment[]): RawComment[] {
  return [...comments].sort(
    (left, right) => left.timestampMs - right.timestampMs,
  );
}

export function collectCommentsAroundPeak(
  comments: RawComment[],
  startMs: number,
  endMs: number,
  maxComments = 30,
): RawComment[] {
  const selected = normalizeComments(comments).filter(
    (comment) => comment.timestampMs >= startMs && comment.timestampMs <= endMs,
  );

  const centerMs = (startMs + endMs) / 2;
  return selected
    .sort(
      (left, right) =>
        Math.abs(left.timestampMs - centerMs) -
        Math.abs(right.timestampMs - centerMs),
    )
    .slice(0, maxComments)
    .sort((left, right) => left.timestampMs - right.timestampMs);
}

export function sliceSubtitleSnippet(
  segments: SubtitleSegment[],
  centerMs: number,
  beforeMs: number,
  afterMs: number,
  maxChars = 1200,
): string | undefined {
  const startMs = Math.max(0, centerMs - beforeMs);
  const endMs = centerMs + afterMs;
  const text = segments
    .filter((segment) => segment.endMs >= startMs && segment.startMs <= endMs)
    .map((segment) => segment.text.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    return undefined;
  }

  if (text.length <= maxChars) {
    return text;
  }

  const centerText = text.slice(0, maxChars);
  return centerText.trim();
}

export function buildPeakContextCandidate(
  candidateIndex: number,
  peakTimestampMs: number,
  comments: RawComment[],
  subtitleSegments: SubtitleSegment[] | undefined,
  windowBeforeMs: number,
  windowAfterMs: number,
): PeakContextCandidate {
  const subtitleSnippet = subtitleSegments
    ? sliceSubtitleSnippet(
        subtitleSegments,
        peakTimestampMs,
        windowBeforeMs,
        windowAfterMs,
      )
    : undefined;

  return {
    candidateIndex,
    peakTimestampMs,
    peakTimestampSec: Math.floor(peakTimestampMs / 1000),
    comments,
    subtitleSnippet,
  };
}

export function buildPeakContextCandidates(
  clips: ClipRange[],
  comments: RawComment[],
  subtitleSegments: SubtitleSegment[] | undefined,
  windowBeforeMs: number,
  windowAfterMs: number,
): PeakContextCandidate[] {
  return clips.map((clip, index) => {
    const peakComments = collectCommentsAroundPeak(
      comments,
      clip.startMs,
      clip.endMs,
    );

    return buildPeakContextCandidate(
      index + 1,
      clip.peakTimestampMs,
      peakComments,
      subtitleSegments,
      windowBeforeMs,
      windowAfterMs,
    );
  });
}
