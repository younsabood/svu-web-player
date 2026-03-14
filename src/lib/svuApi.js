const DEFAULT_TIMEOUT_MS = 30000;

export const createSvuUrl = (endpoint, params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return `/api/svu/${endpoint}${query ? `?${query}` : ''}`;
};

export const fetchSvu = async (endpoint, params = {}, { timeoutMs = DEFAULT_TIMEOUT_MS, signal } = {}) => {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);

  const abortHandler = () => controller.abort(signal?.reason);
  if (signal) {
    signal.addEventListener('abort', abortHandler, { once: true });
  }

  try {
    const response = await fetch(createSvuUrl(endpoint, params), {
      signal: controller.signal,
      headers: {
        Accept: 'application/json'
      }
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      throw new Error('Unexpected server response');
    }

    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || 'Request failed');
    }

    return payload.data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('The request timed out');
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', abortHandler);
    }
  }
};
