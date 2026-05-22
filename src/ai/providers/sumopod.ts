import OpenAI from "openai";
import { AiRankRequest, AiRanker, PeakRankResponse } from "../types";

export interface SumopodConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

function normalizeBaseUrl(value?: string): string {
  return value?.trim() || "https://api.sumopod.com/v1";
}

function formatJsonValue(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatErrorDetails(error: unknown): string {
  if (error instanceof OpenAI.APIError) {
    const details: string[] = [];

    details.push(`status=${error.status}`);

    if (error.code) {
      details.push(`code=${error.code}`);
    }

    if (error.type) {
      details.push(`type=${error.type}`);
    }

    if (error.requestID) {
      details.push(`request_id=${error.requestID}`);
    }

    if (error.error !== undefined) {
      details.push(`body=${formatJsonValue(error.error)}`);
    }

    details.push(`message=${error.message}`);

    return details.join(" | ");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("``")) {
    return trimmed;
  }

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseRankResponse(content: string): PeakRankResponse {
  const raw = stripCodeFence(content);
  const parsed = JSON.parse(raw) as PeakRankResponse;

  if (!parsed || !Array.isArray(parsed.selected)) {
    throw new Error("Sumopod response did not contain a valid selected array");
  }

  return {
    selected: parsed.selected
      .filter((item) => Number.isInteger(item.candidateIndex))
      .map((item) => ({
        candidateIndex: item.candidateIndex,
        reason: String(item.reason ?? "").trim(),
        score: Number(item.score ?? 0),
      })),
  };
}

export class SumopodRanker implements AiRanker {
  private client?: OpenAI;

  constructor(private readonly config: SumopodConfig) {}

  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: normalizeBaseUrl(this.config.baseUrl),
      });
    }

    return this.client;
  }

  async rankPeaks(request: AiRankRequest): Promise<PeakRankResponse> {
    if (!this.config.apiKey.trim()) {
      throw new Error("Sumopod API key is missing. Set SUMOPOD_API_KEY.");
    }

    let content: string | null | undefined;

    try {
      const response = await this.getClient().chat.completions.create({
        model: this.config.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: [
              request.systemPrompt,
              request.contextRules,
              request.outputFormat,
            ].join("\n\n"),
          },
          {
            role: "user",
            content: [
              request.taskPrompt,
              "Candidates:",
              JSON.stringify(request.candidates, null, 2),
            ].join("\n\n"),
          },
        ],
      });

      content = response.choices?.[0]?.message?.content;
    } catch (error) {
      throw new Error(
        `Sumopod request failed (model=${this.config.model}, baseUrl=${normalizeBaseUrl(this.config.baseUrl)}): ${formatErrorDetails(error)}`,
      );
    }

    if (!content) {
      throw new Error("Sumopod response did not include message content");
    }

    return parseRankResponse(content);
  }
}
