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
  constructor(private readonly config: OpenRouterConfig) {}

  async rankPeaks(request: AiRankRequest): Promise<PeakRankResponse> {
    if (!this.config.apiKey.trim()) {
      throw new Error("OpenRouter API key is missing. Set OPENROUTER_API_KEY.");
    }

    const response = await fetch(
      `${normalizeBaseUrl(this.config.baseUrl)}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
          ...(this.config.httpReferer?.trim()
            ? { "HTTP-Referer": this.config.httpReferer.trim() }
            : {}),
          ...(this.config.appTitle?.trim()
            ? { "X-OpenRouter-Title": this.config.appTitle.trim() }
            : {}),
        },
        body: JSON.stringify({
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
        }),
      },
    );

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
        };
      }>;
      error?: {
        message?: string;
      };
    };

    if (!response.ok) {
      const message = payload.error?.message ?? `HTTP ${response.status}`;
      throw new Error(`OpenRouter request failed: ${message}`);
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenRouter response did not include message content");
    }

    return parseRankResponse(content);
  }
}
