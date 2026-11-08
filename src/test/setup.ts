import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';

/**
 * jsdom has no dev server, so `fetch` cannot reach the bundled catalogue. Serve the
 * real files from `public/` off disk: the code under test still uses its normal
 * `fetch` path, only the transport is local.
 */
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const match = /(?:^|\/)(data\/[A-Za-z0-9._-]+\.json)$/.exec(url);
  if (match?.[1]) {
    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    try {
      const body = await readFile(resolve(process.cwd(), 'public', match[1]), 'utf8');
      return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
    } catch {
      return new Response('missing', { status: 404 });
    }
  }
  return realFetch(input, init);
}) as typeof fetch;

// jsdom has no media playback: give the element the API surface the engine calls.
Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
  configurable: true,
  value: function play() {
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  },
});

Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  value: function pause() {
    this.dispatchEvent(new Event('pause'));
  },
});

Object.defineProperty(window.HTMLMediaElement.prototype, 'load', {
  configurable: true,
  value: function load() {
    /* no-op in tests */
  },
});

// jsdom rejects remote sources; keep the assignment inert.
Object.defineProperty(window.HTMLMediaElement.prototype, 'src', {
  configurable: true,
  get(this: HTMLMediaElement & { _src?: string }) {
    return this._src ?? '';
  },
  set(this: HTMLMediaElement & { _src?: string }, value: string) {
    this._src = value;
    Object.defineProperty(this, 'duration', { configurable: true, value: 12, writable: true });
    setTimeout(() => {
      this.dispatchEvent(new Event('durationchange'));
      this.dispatchEvent(new Event('canplay'));
    }, 0);
  },
});

// A minimal AudioContext so the engine can build its graph where it needs to.
class FakeAnalyser {
  fftSize = 1024;
  smoothingTimeConstant = 0.8;
  frequencyBinCount = 512;
  getByteFrequencyData(target: Uint8Array) {
    target.fill(96);
  }
  connect() {
    return this;
  }
  disconnect() {
    /* no-op */
  }
}

class FakeAudioContext {
  state = 'running';
  destination = {} as AudioDestinationNode;
  createAnalyser() {
    return new FakeAnalyser() as unknown as AnalyserNode;
  }
  createMediaElementSource() {
    return { connect: () => undefined, disconnect: () => undefined } as unknown as MediaElementAudioSourceNode;
  }
  async resume() {
    this.state = 'running';
  }
  async close() {
    return undefined;
  }
}

if (!('AudioContext' in window)) {
  Object.defineProperty(window, 'AudioContext', { configurable: true, value: FakeAudioContext });
}

// jsdom lacks these browser APIs that components call defensively.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

if (!('ResizeObserver' in window)) {
  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    value: class {
      observe() {
        /* no-op */
      }
      unobserve() {
        /* no-op */
      }
      disconnect() {
        /* no-op */
      }
    },
  });
}

if (!URL.createObjectURL) {
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:mock' });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => undefined });
}
