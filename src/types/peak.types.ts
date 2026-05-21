export interface TimeSeries {
  timestampMs: number;
  rawScore: number;
  normalizedScore: number;
}

export interface PeakCandidate {
  timestampMs: number;
  normalizedScore: number;
}

export interface ClipRange {
  peakIndex: number;
  peakTimestampMs: number;
  peakTimestampSec: number;
  startMs: number;
  startSec: number;
  endMs: number;
  endSec: number;
  startFormatted: string;
  endFormatted: string;
  peakFormatted: string;
  normalizedScore: number;
}
