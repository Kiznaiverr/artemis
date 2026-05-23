import { AppConfig } from '../types/config.types';
import { getEnvNumber, getEnvString } from './env';

function normalizeAiProvider(value?: string): AppConfig['ai']['provider'] {
  const normalized = value?.trim().toLowerCase();

  if (normalized === 'sumopod') {
    return 'sumopod';
  }

  return 'openrouter';
}

export const config: AppConfig = {
  videoUrl: '',
  auth: {
    mode: getEnvString('YTDLP_AUTH_MODE', 'none') as AppConfig['auth']['mode'],
    browser: getEnvString('YTDLP_AUTH_BROWSER', 'chrome') as AppConfig['auth']['browser'],
    cookiesFile: getEnvString('YTDLP_COOKIES_FILE', './cookies.txt'),
  },
  ytdlp: {
    executablePath: getEnvString('YTDLP_EXECUTABLE', 'yt-dlp'),
    jsRuntime: getEnvString('YTDLP_JS_RUNTIME', 'node'),
    outputDir: getEnvString('YTDLP_OUTPUT_DIR', './output/chat'),
  },
  topN: getEnvNumber('TOP_N', 5),
  clipPadding: {
    before: getEnvNumber('CLIP_PADDING_BEFORE', 60),
    after: getEnvNumber('CLIP_PADDING_AFTER', 60),
  },
  window: {
    size: getEnvNumber('WINDOW_SIZE', 30),
    step: getEnvNumber('WINDOW_STEP', 5),
  },
  peak: {
    minGapSeconds: getEnvNumber('PEAK_MIN_GAP_SECONDS', 180),
  },
  filter: {
    enabled: true,
    minLength: 2,
  },
  ai: {
    provider: normalizeAiProvider(
      getEnvString('api_provider', getEnvString('API_PROVIDER', 'openrouter')),
    ),
    openrouter: {
      apiKey: getEnvString('openrouter_api_key', getEnvString('OPENROUTER_API_KEY', '')),
      model: 'deepseek/deepseek-v4-flash:free',
      baseUrl: 'https://openrouter.ai/api/v1',
      httpReferer: 'https://github.com/kiznaiverr/artemis',
      appTitle: 'artemis',
    },
    sumopod: {
      apiKey: getEnvString('sumopod_api_key', getEnvString('SUMOPOD_API_KEY', '')),
      model: getEnvString('SUMOPOD_MODEL', 'deepseek-v4-flash'),
      baseUrl: getEnvString('SUMOPOD_BASE_URL', 'https://ai.sumopod.com/v1'),
    },
  },
  output: {
    dir: './output',
    filename: 'peaks.json',
  },
};
