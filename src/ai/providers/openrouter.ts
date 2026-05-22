import OpenAI from "openai";
import { AiRankRequest, AiRanker, PeakRankResponse } from "../types";

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  httpReferer?: string;
  appTitle?: string;
}

function normalizeBaseUrl(value?: string): string {
  return value?.trim() || "https://openrouter.ai/api/v1";
}

function normalizeHeaderValue(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
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
    throw new Error(
      "OpenRouter response did not contain a valid selected array",
    );
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

export class OpenRouterRanker implements AiRanker {
  private client?: OpenAI;

  constructor(private readonly config: OpenRouterConfig) {}

  private getClient(): OpenAI {
    if (!this.client) {
      const httpReferer = normalizeHeaderValue(this.config.httpReferer);
      const appTitle = normalizeHeaderValue(this.config.appTitle);

      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: normalizeBaseUrl(this.config.baseUrl),
        defaultHeaders: {
          ...(httpReferer ? { "HTTP-Referer": httpReferer } : {}),
          ...(appTitle ? { "X-Title": appTitle } : {}),
        },
      });
    }

    return this.client;
  }

  async rankPeaks(request: AiRankRequest): Promise<PeakRankResponse> {
    if (!this.config.apiKey.trim()) {
      throw new Error("OpenRouter API key is missing. Set OPENROUTER_API_KEY.");
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
        `OpenRouter request failed: ${formatErrorDetails(error)}`,
      );
    }

    if (!content) {
      throw new Error("OpenRouter response did not include message content");
    }

    return parseRankResponse(content);
  }
}
