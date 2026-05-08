export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function resendFetchWithRetry(url: string, init: RequestInit, maxRetries = 3) {
  let attempt = 0;

  while (true) {
    const response = await fetch(url, init);
    if (response.ok || response.status !== 429 || attempt >= maxRetries) {
      return response;
    }

    const retryAfterHeader = response.headers.get('retry-after');
    const retryAfterSeconds = retryAfterHeader ? parseFloat(retryAfterHeader) : NaN;
    const waitMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? retryAfterSeconds * 1000
      : 1000 * 2 ** attempt;

    await sleep(waitMs + 200);
    attempt += 1;
  }
}
