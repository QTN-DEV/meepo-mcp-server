import { AsyncLocalStorage } from 'async_hooks'

/**
 * Per-request token context using AsyncLocalStorage.
 *
 * When a request arrives via HTTP transports (/mcp or /sse), the OAuth Bearer
 * token is stored here so downstream tool handlers can use it — instead of
 * falling through to the browser-auth flow (which fails in containers).
 */
const tokenStorage = new AsyncLocalStorage<{ bearerToken: string }>()

/**
 * Run a callback with the given bearer token available to all downstream calls.
 */
export function runWithToken<T>(bearerToken: string, fn: () => T): T {
    return tokenStorage.run({ bearerToken }, fn)
}

/**
 * Get the bearer token from the current request context, if available.
 * Returns null when running in stdio mode or outside a request context.
 */
export function getContextToken(): string | null {
    return tokenStorage.getStore()?.bearerToken ?? null
}
