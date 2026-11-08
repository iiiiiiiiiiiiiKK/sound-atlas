/** Small fetch helper: abortable, timeout-bounded, with one retry on network errors. */

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface RequestOptions {
  timeoutMs?: number;
  retries?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export async function getJson<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 15000, retries = 1, signal, headers } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);

    try {
      const response = await fetch(url, { signal: controller.signal, headers });
      if (!response.ok) {
        throw new HttpError(`Request failed with ${response.status}`, response.status);
      }
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      const aborted = controller.signal.aborted && !signal?.aborted;
      if (error instanceof HttpError && error.status && error.status < 500) throw error;
      if (signal?.aborted) throw error;
      if (aborted) throw new HttpError('The request timed out');
      if (attempt === retries) throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
  throw lastError instanceof Error ? lastError : new HttpError('Unknown network error');
}

/** Reads a bundled JSON file, honouring Vite's base path. */
export async function getLocalJson<T>(path: string): Promise<T> {
  const base = import.meta.env.BASE_URL || '/';
  const relative = `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  // jsdom and some Node runtimes reject relative URLs, so resolve against the document.
  const url =
    typeof document !== 'undefined' && document.baseURI
      ? new URL(relative, document.baseURI).toString()
      : relative;
  const response = await fetch(url);
  if (!response.ok) throw new HttpError(`Local asset ${path} returned ${response.status}`, response.status);
  return (await response.json()) as T;
}
