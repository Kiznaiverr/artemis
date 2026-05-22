import fs from "fs";
import path from "path";
import readline from "readline";
import { spawn } from "child_process";
import { AppConfig } from "../types/config.types";
import { LiveChatRawEntry, WeightedEvent } from "../types/comment.types";
import { logger } from "../utils/logger";
import { scoreComment } from "./parser";

const PROGRESS_LOG_INTERVAL_MS = 5000;
const DEFAULT_YTDLP_TIMEOUT_MS = 5 * 60 * 1000;

let lastProgressSummary = "";
let lastProgressLoggedAt = 0;

const FATAL_YTDLP_PATTERNS = [
  /there are no subtitles for the requested languages/i,
  /no subtitles were downloaded/i,
  /requested subtitles not available/i,
  /live chat replay is not available/i,
  /this video does not have a live chat replay/i,
  /unable to download video subtitles/i,
];

function normalizeProgressLine(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

function jobPrefix(alias?: string): string {
  return alias ? `[${alias}]` : "[job]";
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

function logYtDlpOutput(
  chunk: Buffer,
  source: "stdout" | "stderr",
  alias?: string,
): void {
  const text = chunk.toString("utf8");
  const lines = text.split(/\r?\n|\r/).map((line) => line.trim());
  const prefix = jobPrefix(alias);

  for (const line of lines) {
    if (!line) continue;

    if (line.includes("[download]") || line.includes("[info]")) {
      if (shouldLogProgressLine(line)) {
        logger.debug(`${prefix} [yt-dlp:${source}] ${lastProgressSummary}`);
      }
      logger.debug(`${prefix} [yt-dlp:${source}] ${line}`);
      continue;
    }

    logger.debug(`${prefix} [yt-dlp:${source}] ${line}`);
  }
}

function detectFatalYtDlpError(output: string): string | null {
  for (const line of output.split(/\r?\n|\r/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    for (const pattern of FATAL_YTDLP_PATTERNS) {
      if (pattern.test(trimmed)) {
        return trimmed;
      }
    }
  }

  return null;
}

function getYtDlpTimeoutMs(): number {
  const rawTimeout = process.env.YTDLP_TIMEOUT_MS;
  if (!rawTimeout || rawTimeout.trim() === "") {
    return DEFAULT_YTDLP_TIMEOUT_MS;
  }

  const parsed = Number(rawTimeout);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_YTDLP_TIMEOUT_MS;
  }

  return parsed;
}

function runYtDlp(
  args: string[],
  executablePath: string,
  alias?: string,
): Promise<void> {
  const timeoutMs = getYtDlpTimeoutMs();

  return new Promise((resolve, reject) => {
    const proc = spawn(executablePath, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdoutBuffer = "";
    let stderrBuffer = "";
    let finished = false;
    let timeoutHandle: NodeJS.Timeout | undefined;

    const settle = (callback: () => void): void => {
      if (finished) {
        return;
      }

      finished = true;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      callback();
    };

    logger.debug(
      `${jobPrefix(alias)} [yt-dlp] spawned pid=${proc.pid ?? "unknown"}`,
    );

    proc.stdout.on("data", (data: Buffer) => {
      stdoutBuffer += data.toString("utf8");
      logYtDlpOutput(data, "stdout", alias);
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderrBuffer += data.toString("utf8");
      logYtDlpOutput(data, "stderr", alias);
    });

    proc.on("error", (err) => {
      settle(() => {
        reject(
          new Error(
            `${jobPrefix(alias)} Failed to start yt-dlp: ${err.message}\n` +
              `Make sure yt-dlp is installed and available in PATH.\n` +
              `Install: pip install yt-dlp`,
          ),
        );
      });
    });

    proc.on("exit", (code, signal) => {
      logger.debug(
        `${jobPrefix(alias)} [yt-dlp] exit pid=${proc.pid ?? "unknown"} code=${code ?? "null"} signal=${signal ?? "null"}`,
      );
    });

    proc.on("close", (code) => {
      const fatalMessage =
        detectFatalYtDlpError(stderrBuffer) ??
        detectFatalYtDlpError(stdoutBuffer);

      settle(() => {
        if (fatalMessage) {
          reject(
            new Error(
              `${jobPrefix(alias)} yt-dlp reported that live chat subtitles are unavailable: ${fatalMessage}`,
            ),
          );
          return;
        }

        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(
              `${jobPrefix(alias)} yt-dlp exited with code ${code}. Check yt-dlp output above for details.`,
            ),
          );
        }
      });
    });

    timeoutHandle = setTimeout(() => {
      logger.warn(
        `${jobPrefix(alias)} [yt-dlp] timeout reached pid=${proc.pid ?? "unknown"}, terminating child process`,
      );

      proc.kill("SIGKILL");
      settle(() => {
        reject(
          new Error(
            `${jobPrefix(alias)} yt-dlp timed out after ${Math.round(timeoutMs / 1000)}s while downloading live chat.`,
          ),
        );
      });
    }, timeoutMs);
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

function createRunOutputDir(outputDir: string): string {
  return fs.mkdtempSync(path.join(outputDir, "run-"));
}

async function parseChatFile(
  filePath: string,
  config: AppConfig,
  alias?: string,
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

  if (alias) {
    logger.debug(`[${alias}] parsed live chat file entries: ${events.length}`);
  }

  return events;
}

export async function fetchLiveChat(
  config: AppConfig,
  alias?: string,
): Promise<WeightedEvent[]> {
  const { executablePath, outputDir } = config.ytdlp;

  fs.mkdirSync(outputDir, { recursive: true });
  const runOutputDir = createRunOutputDir(outputDir);

  const outputTemplate = path.join(runOutputDir, "%(id)s.%(ext)s");
  const args = buildArgs(config, outputTemplate);

  const prefix = jobPrefix(alias);

  logger.info(`${prefix} Downloading live chat via yt-dlp...`);
  logger.info(`${prefix} Video: ${config.videoUrl}`);
  logger.info(`${prefix} Auth mode: ${config.auth.mode}`);

  try {
    await runYtDlp(args, executablePath, alias);

    const chatFile = findChatFile(runOutputDir);
    logger.info(`${prefix} Parsing: ${chatFile}`);

    try {
      const events = await parseChatFile(chatFile, config, alias);
      logger.info(`${prefix} Parsed ${events.length} weighted events.`);

      if (events.length === 0) {
        throw new Error(
          `${prefix} No comments parsed. The live chat replay may be empty or unsupported.`,
        );
      }

      return events;
    } finally {
      try {
        if (fs.existsSync(chatFile)) {
          fs.unlinkSync(chatFile);
          logger.info(`${prefix} Deleted raw chat file: ${chatFile}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.debug(`${prefix} Failed to delete raw chat file: ${message}`);
      }
    }
  } finally {
    try {
      fs.rmSync(runOutputDir, { recursive: true, force: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.debug(`${prefix} Failed to remove run output dir: ${message}`);
    }
  }
}
