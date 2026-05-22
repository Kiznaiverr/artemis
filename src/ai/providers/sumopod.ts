import { AiRankRequest, AiRanker, PeakRankResponse } from "../types";

export interface SumopodConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export class SumopodRanker implements AiRanker {
  constructor(private readonly config: SumopodConfig) {}

  async rankPeaks(_request: AiRankRequest): Promise<PeakRankResponse> {
    throw new Error(
      `SumopodRanker is scaffolded but not wired yet. Provide the provider endpoint before using model ${this.config.model}.`,
    );
  }
}