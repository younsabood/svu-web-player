/**
 * Executes a promise-returning function with automatic retries.
 * @param {Function} fn - The function to execute.
 * @param {number} retries - Number of retries before failing.
 * @param {number} delayMs - Delay between retries in milliseconds.
 * @param {AbortSignal} signal - Optional abort signal to cancel retries.
 * @returns {Promise<any>}
 */
export const withRetry = async (fn, retries = 3, delayMs = 1000, signal = null) => {
  let attempt = 0;
  while (attempt < retries) {
    if (signal?.aborted) throw new Error('Operation aborted by user');
    try {
      return await fn();
    } catch (error) {
      attempt++;
      if (attempt >= retries || signal?.aborted) {
        throw error;
      }
      console.warn(`[Retry] Attempt ${attempt} failed, retrying in ${delayMs}ms... Error:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
};
