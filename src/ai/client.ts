import { AiRanker } from "./types";
import { OpenRouterRanker } from "./providers/openrouter";
import { SumopodRanker } from "./providers/sumopod";
import { AiProviderName } from "../types/config.types";

export interface AiClientConfig {
  provider: AiProviderName;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export function createAiRanker(config: AiClientConfig): AiRanker {
  if (config.provider === "openrouter") {
    return new OpenRouterRanker({
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl,
    });
  }

  return new SumopodRanker({
    apiKey: config.apiKey,
    model: config.model,
    baseUrl: config.baseUrl,
  });
}
