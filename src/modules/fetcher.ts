import fs from "fs";
import path from "path";
import readline from "readline";
import { spawn } from "child_process";
import { AppConfig } from "../types/config.types";
import { LiveChatRawEntry, WeightedEvent } from "../types/comment.types";
import { logger } from "../utils/logger";
import { scoreComment } from "./parser";

const PROGRESS_LOG_INTERVAL_MS = 5000;

let lastProgressSummary = "";
let lastProgressLoggedAt = 0;

function normalizeProgressLine(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

function shouldLogProgressLine(line: string): boolean {
  const now = Date.now();

  if (line.includes("Destination:") || line.includes("Downloading live chat")) {
    lastProgressSummary = normalizeProgressLine(line);
    lastProgressLoggedAt = now;
    return true;
  }

  if (now - lastProgressLoggedAt >= PROGRESS_LOG_INTERVAL_MS) {
    lastProgressSummary = normalizeProgressLine(line);
    lastProgressLoggedAt = now;
    return true;
  }

  return false;
}

function logYtDlpOutput(chunk: Buffer): void {
  const text = chunk.toString("utf8");
  const lines = text.split(/\r?\n|\r/).map((line) => line.trim());

  for (const line of lines) {
    if (!line) continue;

    const isProgressLine =
      line.includes("[download]") ||
      line.includes("[ExtractAudio]") ||
      line.includes("[info]") ||
      line.includes("[generic]") ||
      line.includes("[youtube]") ||
      line.includes("[youtube_live_chat]");

    if (isProgressLine) {
      if (shouldLogProgressLine(line)) {
        logger.debug(lastProgressSummary);
      }
      continue;
    }

    logger.debug(line);
  }
}

function runYtDlp(args: string[], executablePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(executablePath, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    proc.stdout.on("data", (data: Buffer) => {
      logYtDlpOutput(data);
    });

    proc.stderr.on("data", (data: Buffer) => {
      logYtDlpOutput(data);
    });

    proc.on("error", (err) => {
      reject(
        new Error(
          `Failed to start yt-dlp: ${err.message}\n` +
            `Make sure yt-dlp is installed and available in PATH.\n` +
            `Install: pip install yt-dlp`,
        ),
      );
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`yt-dlp exited with code ${code}`));
      }
    });
  });
}

function buildArgs(config: AppConfig, outputTemplate: string): string[] {
  const args: string[] = [
    config.videoUrl,
    "--skip-download",
    "--write-subs",
    "--sub-langs",
    "live_chat",
    "-o",
    outputTemplate,
  ];

  if (config.auth.mode === "browser") {
    args.push("--cookies-from-browser", config.auth.browser ?? "chrome");
  } else if (config.auth.mode === "cookies-file") {
    const cookiesFile = config.auth.cookiesFile ?? "./cookies.txt";
    if (!fs.existsSync(cookiesFile)) {
      throw new Error(`cookies-file not found: ${cookiesFile}`);
    }
    args.push("--cookies", cookiesFile);
  }

  return args;
}

function findChatFile(outputDir: string): string {
  const files = fs
    .readdirSync(outputDir)
    .filter((file) => file.endsWith(".live_chat.json"));

  if (files.length === 0) {
    throw new Error(
      `yt-dlp completed but no .live_chat.json found in ${outputDir}.\n` +
        `This video may not have a live chat replay available.`,
    );
  }

  const sorted = files
    .map((file) => ({
      file,
      mtime: fs.statSync(path.join(outputDir, file)).mtimeMs,
    }))
    .sort((left, right) => right.mtime - left.mtime);

  return path.join(outputDir, sorted[0].file);
}

async function parseChatFile(
  filePath: string,
  config: AppConfig,
): Promise<WeightedEvent[]> {
  const events: WeightedEvent[] = [];
  const input = fs.createReadStream(filePath, { encoding: "utf8" });
  const reader = readline.createInterface({
    input,
    crlfDelay: Infinity,
  });

  try {
    for await (const line of reader) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let entry: LiveChatRawEntry;
      try {
        entry = JSON.parse(trimmed) as LiveChatRawEntry;
      } catch {
        continue;
      }

      const actions = entry.replayChatItemAction?.actions ?? [];

      for (const action of actions) {
        const renderer =
          action.addChatItemAction?.item?.liveChatTextMessageRenderer;
        if (!renderer) continue;

        const offsetMs = parseInt(
          renderer.videoOffsetTimeMsec ??
            entry.replayChatItemAction?.videoOffsetTimeMsec ??
            "0",
          10,
        );

        if (Number.isNaN(offsetMs) || offsetMs < 0) continue;

        const text = (renderer.message?.runs ?? [])
          .map((run) => run.text ?? "")
          .join("")
          .trim();

        if (!text) continue;

        const event = scoreComment(
          {
            text,
            timestampMs: offsetMs,
          },
          config,
        );

        if (event) {
          events.push(event);
        }
      }
    }
  } finally {
    reader.close();
    input.close();
  }

  return events;
}

export async function fetchLiveChat(
  config: AppConfig,
): Promise<WeightedEvent[]> {
  const { executablePath, outputDir } = config.ytdlp;

  fs.mkdirSync(outputDir, { recursive: true });

  const outputTemplate = path.join(outputDir, "%(id)s.%(ext)s");
  const args = buildArgs(config, outputTemplate);

  logger.info(`Downloading live chat via yt-dlp...`);
  logger.info(`Video: ${config.videoUrl}`);
  logger.info(`Auth mode: ${config.auth.mode}`);

  await runYtDlp(args, executablePath);

  const chatFile = findChatFile(outputDir);
  logger.info(`Parsing: ${chatFile}`);

  try {
    const events = await parseChatFile(chatFile, config);
    logger.info(`Parsed ${events.length} weighted events.`);

    if (events.length === 0) {
      throw new Error(
        "No comments parsed. The live chat replay may be empty or unsupported.",
      );
    }

    return events;
  } finally {
    try {
      if (fs.existsSync(chatFile)) {
        fs.unlinkSync(chatFile);
        logger.info(`Deleted raw chat file: ${chatFile}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.debug(`Failed to delete raw chat file: ${message}`);
    }
  }
}
