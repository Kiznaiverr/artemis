export const AI_PROVIDER_DEFAULTS = {
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'deepseek/deepseek-v4-flash:free',
    httpReferer: 'https://github.com/kiznaiverr/artemis',
    appTitle: 'artemis',
  },
  sumopod: {
    baseUrl: 'https://ai.sumopod.com/v1',
    model: 'deepseek-v4-flash',
  },
} as const;

export const OUTPUT_DEFAULTS = {
  dir: './output',
  filename: 'peaks.json',
} as const;
