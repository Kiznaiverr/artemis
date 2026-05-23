import { AppConfig } from "../types/config.types";
import { RawComment } from "../types/comment.types";
import { ClipRange } from "../types/peak.types";
import { createAiRanker } from "./client";
import { buildPeakContextCandidates } from "./context";
import { loadRankerPrompts } from "./promptLoader";
import { PeakRankSelection, SubtitleSegment } from "./types";
import { logger } from "../utils/logger";

function formatDebugJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getAiProviderConfig(config: AppConfig): {
  provider: AppConfig["ai"]["provider"];
  apiKey: string;
  model: string;
  baseUrl: string;
} {
  if (config.ai.provider === "sumopod") {
    return {
      provider: config.ai.provider,
      apiKey: config.ai.sumopod.apiKey,
      model: config.ai.sumopod.model,
      baseUrl: config.ai.sumopod.baseUrl,
    };
  }

  return {
    provider: config.ai.provider,
    apiKey: config.ai.openrouter.apiKey,
    model: config.ai.openrouter.model,
    baseUrl: config.ai.openrouter.baseUrl,
  };
}

function jobPrefix(alias?: string): string {
  return alias ? `[${alias}]` : "[job]";
}

function remapPeakIndex(clip: ClipRange, peakIndex: number): ClipRange {
  return {
    ...clip,
    peakIndex,
  };
}

function fallbackTopClips(clips: ClipRange[], limit: number): ClipRange[] {
  return clips
    .slice(0, limit)
    .map((clip, index) => remapPeakIndex(clip, index + 1));
}

function selectClipsByRank(
  clips: ClipRange[],
  selections: PeakRankSelection[],
  limit: number,
): ClipRange[] {
  const byIndex = new Map<number, ClipRange>();

  for (const clip of clips) {
    byIndex.set(clip.peakIndex, clip);
  }

  const selected: ClipRange[] = [];
  const seen = new Set<number>();

  for (const selection of selections) {
    const clip = byIndex.get(selection.candidateIndex);
    if (!clip || seen.has(selection.candidateIndex)) {
      continue;
    }

    seen.add(selection.candidateIndex);
    selected.push(clip);

    if (selected.length >= limit) {
      break;
    }
  }

  return selected.map((clip, index) => remapPeakIndex(clip, index + 1));
}

export async function rerankPeakClips(
  clips: ClipRange[],
  comments: RawComment[],
  subtitleSegments: SubtitleSegment[] | undefined,
  config: AppConfig,
  alias?: string,
): Promise<ClipRange[]> {
  const prefix = jobPrefix(alias);
  const limit = Math.min(config.topN, clips.length);

  if (limit === 0) {
    return [];
  }

  const aiConfig = getAiProviderConfig(config);
  const apiKey = aiConfig.apiKey.trim();
  if (!apiKey) {
    logger.warn(
      `${prefix} ${aiConfig.provider} API key missing, using heuristic peaks only`,
    );
    return fallbackTopClips(clips, limit);
  }

  try {
    const prompts = await loadRankerPrompts();

    // Tighten prompts with strict, unambiguous rules for the model.
    const strictAddendum = `Strict rules:\n- Return JSON only, exactly matching the requested schema. Do not include any surrounding text, explanation, or markdown.\n- Return at most ${limit} items in the \"selected\" array. Do not return more.\n- Each selected item must include: integer \"candidateIndex\" (1-based index into the provided Candidates array), \"reason\" (short, <=140 chars), and \"score\" (number between 0 and 1).\n- Order \"selected\" from best to worst.\n- Do not add extra fields or nested objects.\n- Reasons must cite brief evidence from the candidate context (e.g. \"chat_count=12, caps=3, subtitle=\"wow\"\").\n- If unsure, prefer candidates with higher chat density and clearer escalation signals.\n- Do not hallucinate or invent facts not present in the provided comments/subtitle snippets.`;
    const ranker = createAiRanker({
      provider: aiConfig.provider,
      apiKey,
      model: aiConfig.model,
      baseUrl: aiConfig.baseUrl,
    });

    const candidates = buildPeakContextCandidates(
      clips,
      comments,
      subtitleSegments,
      config.clipPadding.before * 1000,
      config.clipPadding.after * 1000,
    );

    logger.debug(
      `${prefix} AI request payload: ${formatDebugJson({
        provider: aiConfig.provider,
        model: aiConfig.model,
        baseUrl: aiConfig.baseUrl,
        candidateCount: candidates.length,
        candidates,
        systemPrompt: prompts.systemPrompt,
        taskPrompt: `${prompts.taskPrompt}\n\n${strictAddendum}`,
        contextRules: prompts.contextRules,
        outputFormat: prompts.outputFormat,
      })}`,
    );

    const result = await ranker.rankPeaks({
      candidates,
      systemPrompt: prompts.systemPrompt,
      taskPrompt: `${prompts.taskPrompt}\n\n${strictAddendum}`,
      contextRules: prompts.contextRules,
      outputFormat: prompts.outputFormat,
    });

    const ranked = selectClipsByRank(clips, result.selected, limit);
    if (ranked.length === 0) {
      logger.warn(
        `${prefix} AI returned no valid selections, using heuristic peaks`,
      );
      return fallbackTopClips(clips, limit);
    }

    logger.info(`${prefix} AI selected peaks: ${ranked.length}`);
    return ranked;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(
      `${prefix} AI rerank failed, using heuristic peaks: ${message}`,
    );
    return fallbackTopClips(clips, limit);
  }
}
