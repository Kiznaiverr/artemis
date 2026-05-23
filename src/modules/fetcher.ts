import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { spawn } from 'child_process';
import { AppConfig } from '../types/config.types';
import { LiveChatData, LiveChatRawEntry, RawComment, WeightedEvent } from '../types/comment.types';
import { logger } from '../utils/logger';
import { scoreComment } from './parser';
import { loadBestSubtitleSegments } from '../ai/subtitleParser';
import { getPositiveEnvNumber } from '../config/env';

const PROGRESS_LOG_INTERVAL_MS = 5000;
const DEFAULT_YTDLP_TIMEOUT_MS = 5 * 60 * 1000;

const FATAL_YTDLP_PATTERNS = [
  /there are no subtitles for the requested languages/i,
  /no subtitles were downloaded/i,
  /requested subtitles not available/i,
  /live chat replay is not available/i,
  /this video does not have a live chat replay/i,
  /unable to download video subtitles/i,
];

type ProgressLogState = {
  lastProgressSummary: string;
  lastProgressLoggedAt: number;
};

function normalizeProgressLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

function jobPrefix(alias?: string): string {
  return alias ? `[${alias}]` : '[job]';
}

function shouldLogProgressLine(line: string, state: ProgressLogState): boolean {
  const now = Date.now();

  if (line.includes('Destination:') || line.includes('Downloading live chat')) {
    state.lastProgressSummary = normalizeProgressLine(line);
    state.lastProgressLoggedAt = now;
    return true;
  }

  if (
    state.lastProgressLoggedAt === 0 ||
    now - state.lastProgressLoggedAt >= PROGRESS_LOG_INTERVAL_MS
  ) {
    state.lastProgressSummary = normalizeProgressLine(line);
    state.lastProgressLoggedAt = now;
    return true;
  }

  return false;
}

function logYtDlpOutput(
  chunk: Buffer,
  source: 'stdout' | 'stderr',
  alias?: string,
  state: ProgressLogState = {
    lastProgressSummary: '',
    lastProgressLoggedAt: 0,
  },
): void {
  const text = chunk.toString('utf8');
  const lines = text.split(/\r?\n|\r/).map((line) => line.trim());
  const prefix = jobPrefix(alias);

  for (const line of lines) {
    if (!line) continue;

    if (line.includes('[download]') || line.includes('[info]')) {
      if (shouldLogProgressLine(line, state)) {
        logger.debug(`${prefix} [yt-dlp:${source}] ${state.lastProgressSummary}`);
      }
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
  return getPositiveEnvNumber('YTDLP_TIMEOUT_MS', DEFAULT_YTDLP_TIMEOUT_MS);
}

function runYtDlp(args: string[], executablePath: string, alias?: string): Promise<void> {
  const timeoutMs = getYtDlpTimeoutMs();
  const progressState: ProgressLogState = {
    lastProgressSummary: '',
    lastProgressLoggedAt: 0,
  };

  return new Promise((resolve, reject) => {
    const proc = spawn(executablePath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdoutBuffer = '';
    let stderrBuffer = '';
    let finished = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

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

    logger.debug(`${jobPrefix(alias)} [yt-dlp] spawned pid=${proc.pid ?? 'unknown'}`);

    proc.stdout.on('data', (data: Buffer) => {
      stdoutBuffer += data.toString('utf8');
      logYtDlpOutput(data, 'stdout', alias, progressState);
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderrBuffer += data.toString('utf8');
      logYtDlpOutput(data, 'stderr', alias, progressState);
    });

    proc.on('error', (err) => {
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

    proc.on('exit', (code, signal) => {
      logger.debug(
        `${jobPrefix(alias)} [yt-dlp] exit pid=${proc.pid ?? 'unknown'} code=${code ?? 'null'} signal=${signal ?? 'null'}`,
      );
    });

    proc.on('close', (code) => {
      const fatalMessage =
        detectFatalYtDlpError(stderrBuffer) ?? detectFatalYtDlpError(stdoutBuffer);

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
        `${jobPrefix(alias)} [yt-dlp] timeout reached pid=${proc.pid ?? 'unknown'}, terminating child process`,
      );

      proc.kill('SIGKILL');
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

function buildBaseArgs(config: AppConfig, outputTemplate: string): string[] {
  const args: string[] = [
    config.videoUrl,
    '--skip-download',
    '--write-subs',
    '--write-auto-subs',
    '-o',
    outputTemplate,
  ];

  if (config.ytdlp.jsRuntime) {
    args.push('--js-runtimes', config.ytdlp.jsRuntime);
  }

  args.push('--remote-components', 'ejs:github');

  if (config.auth.mode === 'browser') {
    args.push('--cookies-from-browser', config.auth.browser ?? 'chrome');
  } else if (config.auth.mode === 'cookies-file') {
    const cookiesFile = config.auth.cookiesFile ?? './cookies.txt';
    if (!fs.existsSync(cookiesFile)) {
      throw new Error(`cookies-file not found: ${cookiesFile}`);
    }
    args.push('--cookies', cookiesFile);
  }

  return args;
}

function buildArgs(config: AppConfig, outputTemplate: string): string[] {
  const args = buildBaseArgs(config, outputTemplate);
  args.splice(3, 0, '--sub-langs', 'live_chat');
  return args;
}

function findChatFile(outputDir: string): string {
  const files = fs.readdirSync(outputDir).filter((file) => file.endsWith('.live_chat.json'));

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
  return fs.mkdtempSync(path.join(outputDir, 'run-'));
}

async function parseChatFile(
  filePath: string,
  config: AppConfig,
  alias?: string,
): Promise<LiveChatData> {
  const events: WeightedEvent[] = [];
  const comments: RawComment[] = [];
  const input = fs.createReadStream(filePath, { encoding: 'utf8' });
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
        const renderer = action.addChatItemAction?.item?.liveChatTextMessageRenderer;
        if (!renderer) continue;

        const offsetMs = parseInt(
          renderer.videoOffsetTimeMsec ?? entry.replayChatItemAction?.videoOffsetTimeMsec ?? '0',
          10,
        );

        if (Number.isNaN(offsetMs) || offsetMs < 0) continue;

        const text = (renderer.message?.runs ?? [])
          .map((run) => run.text ?? '')
          .join('')
          .trim();

        if (!text) continue;

        comments.push({
          text,
          timestampMs: offsetMs,
        });

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
    logger.debug(
      `[${alias}] parsed live chat file entries: comments=${comments.length} weighted=${events.length}`,
    );
  }

  return { events, comments };
}

export async function fetchLiveChat(config: AppConfig, alias?: string): Promise<LiveChatData> {
  const { executablePath, outputDir } = config.ytdlp;

  fs.mkdirSync(outputDir, { recursive: true });
  const runOutputDir = createRunOutputDir(outputDir);

  const outputTemplate = path.join(runOutputDir, '%(id)s.%(ext)s');
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
      const data = await parseChatFile(chatFile, config, alias);
      data.subtitleSegments = await loadBestSubtitleSegments(runOutputDir, alias);
      logger.info(
        `${prefix} Parsed comments=${data.comments.length} weighted=${data.events.length}.`,
      );

      if (data.events.length === 0) {
        throw new Error(
          `${prefix} No comments parsed. The live chat replay may be empty or unsupported.`,
        );
      }

      return data;
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
