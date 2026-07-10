/**
 * @file Retry Utility
 *
 * Implements exponential backoff retry logic for external API requests.
 * Helps handle transient network errors and rate limits (429 status).
 *
 * @module retry
 */

import axios from 'axios';

/**
 * Delays execution for the specified number of milliseconds.
 *
 * @param ms - Milliseconds to wait
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps an asynchronous operation with retry logic using exponential backoff.
 * Retries on any failure unless it is an Axios 404 error (which means resource not found)
 * or another client-level error (e.g. 400 Bad Request, 401 Unauthorized, 403 Forbidden).
 *
 * @template T - The return type of the wrapped function
 * @param fn - The async function to retry
 * @param maxRetries - Maximum number of total attempts, not additional
 *   retries after the first call (default: 3 means 3 attempts total)
 * @param baseDelay - Base delay in milliseconds (default: 1000)
 * @returns The resolved value of the function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;

      // Check if it's an Axios error and decide whether it makes sense to retry
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;

        // Do not retry 404 (Not Found), 400 (Bad Request), 401 (Unauthorized), or 403 (Forbidden)
        if (status && [400, 401, 403, 404].includes(status)) {
          throw error;
        }

        console.warn(
          `[retry] Attempt ${attempt}/${maxRetries} failed with status ${status || 'unknown'}: ${error.message}`
        );
      } else {
        console.warn(
          `[retry] Attempt ${attempt}/${maxRetries} failed with non-Axios error:`,
          error
        );
      }

      if (attempt >= maxRetries) {
        throw error;
      }

      // Calculate exponential backoff delay: baseDelay * 2^(attempt - 1) + jitter
      const backoff = baseDelay * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 200; // Add up to 200ms random jitter
      const totalDelay = backoff + jitter;

      console.log(`[retry] Waiting ${Math.round(totalDelay)}ms before retrying...`);
      await delay(totalDelay);
    }
  }
}
