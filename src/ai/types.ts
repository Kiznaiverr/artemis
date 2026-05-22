import { RawComment } from "../types/comment.types";

export interface SubtitleSegment {
  startMs: number;
  endMs: number;
  text: string;
}

export interface PeakContextCandidate {
  candidateIndex: number;
  peakTimestampMs: number;
  peakTimestampSec: number;
  comments: RawComment[];
  subtitleSnippet?: string;
}

export interface PeakRankSelection {
  candidateIndex: number;
  reason: string;
  score: number;
}

export interface PeakRankResponse {
  selected: PeakRankSelection[];
}

export interface AiRankRequest {
  candidates: PeakContextCandidate[];
  systemPrompt: string;
  taskPrompt: string;
  contextRules: string;
  outputFormat: string;
}

export interface AiRanker {
  rankPeaks(request: AiRankRequest): Promise<PeakRankResponse>;
}
