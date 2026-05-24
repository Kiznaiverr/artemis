import OpenAI from 'openai';
import { AiRankRequest, AiRanker, PeakRankResponse } from '../types';
import { logger } from '../../utils/logger';
import { AI_PROVIDER_DEFAULTS } from '../../config/defaults';
import { formatDebugJson, formatJsonValue, normalizeBaseUrl, stripCodeFence } from '../shared';

export interface SumopodConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

function formatErrorValue(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }

  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value instanceof Error) {
    return formatErrorDetails(value);
  }

  try {
    return JSON.stringify(value, Object.getOwnPropertyNames(value), 2);
  } catch {
    return String(value);
  }
}

function formatFullError(error: Error): string {
  const ownKeys = Object.getOwnPropertyNames(error);
  const fields: string[] = [];

  fields.push(`name=${error.name}`);
  fields.push(`message=${error.message}`);

  for (const key of ownKeys) {
    if (key === 'name' || key === 'message' || key === 'stack') {
      continue;
    }

    const value = (error as unknown as Record<string, unknown>)[key];
    fields.push(`${key}=${formatErrorValue(value)}`);
  }

  if (error.stack) {
    fields.push(`stack=${error.stack}`);
  }

  return fields.join(' | ');
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

    return details.join(' | ');
  }

  if (error instanceof Error) {
    return formatFullError(error);
  }

  return String(error);
}

function parseRankResponse(content: string): PeakRankResponse {
  const raw = stripCodeFence(content);
  const parsed = JSON.parse(raw) as PeakRankResponse;

  if (!parsed || !Array.isArray(parsed.selected)) {
    throw new Error('Sumopod response did not contain a valid selected array');
  }

  return {
    selected: parsed.selected
      .filter((item) => Number.isInteger(item.candidateIndex))
      .map((item) => ({
        candidateIndex: item.candidateIndex,
        reason: String(item.reason ?? '').trim(),
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
        baseURL: normalizeBaseUrl(this.config.baseUrl, AI_PROVIDER_DEFAULTS.sumopod.baseUrl),
      });
    }

    return this.client;
  }

  async rankPeaks(request: AiRankRequest): Promise<PeakRankResponse> {
    if (!this.config.apiKey.trim()) {
      throw new Error('Sumopod API key is missing. Set SUMOPOD_API_KEY.');
    }

    let content: string | null | undefined;

    try {
      // logger.debug(
      //   `[ai][sumopod] sending request: ${formatDebugJson({
      //     model: this.config.model,
      //     baseUrl: normalizeBaseUrl(this.config.baseUrl, AI_PROVIDER_DEFAULTS.sumopod.baseUrl),
      //     messages: [
      //       {
      //         role: 'system',
      //         content: [request.systemPrompt, request.contextRules, request.outputFormat].join(
      //           '\n\n',
      //         ),
      //       },
      //       {
      //         role: 'user',
      //         content: [
      //           request.taskPrompt,
      //           'Candidates:',
      //           JSON.stringify(request.candidates, null, 2),
      //         ].join('\n\n'),
      //       },
      //     ],
      //   })}`,
      // );

      const response = await this.getClient().chat.completions.create({
        model: this.config.model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: [request.systemPrompt, request.contextRules, request.outputFormat].join(
              '\n\n',
            ),
          },
          {
            role: 'user',
            content: [
              request.taskPrompt,
              'Candidates:',
              JSON.stringify(request.candidates, null, 2),
            ].join('\n\n'),
          },
        ],
      });

      content = response.choices?.[0]?.message?.content;

      logger.debug(`[ai][sumopod] raw response content: ${formatDebugJson(content)}`);
    } catch (error) {
      const wrappedError = new Error(
        `Sumopod request failed (model=${this.config.model}, baseUrl=${normalizeBaseUrl(this.config.baseUrl, AI_PROVIDER_DEFAULTS.sumopod.baseUrl)}): ${formatErrorDetails(error)}`,
      ) as Error & { cause?: unknown };

      wrappedError.cause = error;
      throw wrappedError;
    }

    if (!content) {
      throw new Error('Sumopod response did not include message content');
    }

    return parseRankResponse(content);
  }
}
