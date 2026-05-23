export function formatJobPrefix(alias?: string): string {
  return alias ? `[${alias}]` : '[job]';
}

export function buildJobOutputId(jobId: string): string {
  return `${jobId}.json`;
}

export function buildJobCheckUrl(jobId: string): string {
  return `/peaks/${jobId}`;
}

export function buildJobResultUrl(jobId: string): string {
  return `/peaks/${jobId}/result`;
}
