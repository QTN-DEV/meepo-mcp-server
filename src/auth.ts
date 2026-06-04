import { config } from './config.js'
import { loadToken, saveToken, clearToken } from './token-store.js'
import { openBrowserAndWaitForToken } from './browser-auth.js'
import { getContextToken } from './token-context.js'

let cachedToken: string | null = null
let cachedUser: any = null

/**
 * Returns a valid access token.
 *
 * Resolution order:
 * 0. Transport-provided Bearer token (from OAuth — used in HTTP deployments)
 * 1. In-memory cache (fastest)
 * 2. Saved credentials from ~/.meepo/credentials.json
 * 3. Env vars MEEPO_EMAIL / MEEPO_PASSWORD (CI / server deployments)
 * 4. Browser OAuth flow (opens browser, waits for user to sign in)
 */
export async function login(email?: string, password?: string): Promise<{ token: string; user: any }> {
    // If explicit credentials provided, always re-authenticate
    if (email && password) {
        return await loginWithCredentials(email, password)
    }

    // 0. Transport-provided Bearer token (OAuth flow — each user gets their own)
    const contextToken = getContextToken()
    if (contextToken) {
        // Use per-token cache to avoid repeated /me calls for the same token
        if (cachedToken === contextToken && cachedUser) {
            return { token: contextToken, user: cachedUser }
        }
        // Fetch full user profile from auth service (JWT alone doesn't have companyId)
        try {
            const meRes = await fetch(`${config.authServiceUrl}/api/v1/auth/user/me`, {
                headers: { Cookie: `userAccessToken=${contextToken}` }
            })
            if (meRes.ok) {
                const meData = await meRes.json() as any
                const user = meData.data?.user
                if (user) {
                    cachedToken = contextToken
                    cachedUser = user
                    return { token: contextToken, user }
                }
            }
        } catch (err: any) {
            console.error('[meepo-mcp] Failed to fetch user profile from OAuth token:', err.message)
        }
        // Fallback: return token with minimal user info from JWT
        try {
            const payload = JSON.parse(Buffer.from(contextToken.split('.')[1], 'base64url').toString())
            return { token: contextToken, user: { id: payload.userId } }
        } catch {
            return { token: contextToken, user: {} }
        }
    }

    // 1. In-memory cache
    if (cachedToken && cachedUser) {
        return { token: cachedToken, user: cachedUser }
    }

    // 2. Saved credentials on disk
    const stored = loadToken()
    if (stored) {
        cachedToken = stored.accessToken
        cachedUser = stored.user
        return { token: cachedToken, user: cachedUser }
    }

    // 3. Env var credentials (for server/CI deployments with TRANSPORT=sse)
    if (config.email && config.password) {
        return await loginWithCredentials(config.email, config.password)
    }

    // 4. Browser OAuth flow (interactive, for IDE/desktop use)
    process.stderr.write('[meepo-mcp] No credentials found. Opening browser for login…\n')
    const { accessToken, user } = await openBrowserAndWaitForToken()
    cachedToken = accessToken
    cachedUser = user
    // Fetch full user details to populate the cache properly
    try {
        const meRes = await fetch(`${config.authServiceUrl}/api/v1/auth/user/me`, {
            headers: { Cookie: `userAccessToken=${accessToken}` }
        })
        if (meRes.ok) {
            const meData = await meRes.json() as any
            cachedUser = meData.data?.user ?? user
        }
    } catch { /* non-fatal */ }
    saveToken(accessToken, cachedUser)
    return { token: cachedToken, user: cachedUser }
}

async function loginWithCredentials(email: string, password: string): Promise<{ token: string; user: any }> {
    const response = await fetch(`${config.authServiceUrl}/api/v1/auth/user/mcp/sign-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
        const body = await response.json().catch(() => ({})) as any
        throw new Error(`Login failed: ${body?.message || response.statusText}`)
    }

    const result = await response.json() as any
    const user = result.data?.user
    const accessToken = result.data?.accessToken

    if (!accessToken) {
        throw new Error('Login succeeded but no access token returned by the server.')
    }

    cachedToken = accessToken
    cachedUser = user
    saveToken(accessToken, user)
    return { token: accessToken, user }
}

export function logout(): void {
    cachedToken = null
    cachedUser = null
    clearToken()
}

export interface QuotaInfo {
    usedQuota: number
    maxGenerationQuota: number | null
    startDate: string | null
    endDate: string | null
    remaining: number | null
}

export async function checkCredits(): Promise<QuotaInfo> {
    const { token } = await login()

    const response = await fetch(`${config.subscriptionServiceUrl}/api/v1/subscriptions/current/quota`, {
        headers: {
            'Cookie': `userAccessToken=${token}`,
            'Content-Type': 'application/json',
        },
    })

    if (!response.ok) {
        throw new Error(`Credit check failed: ${response.statusText}`)
    }

    const result = await response.json() as any
    const data = result.data

    const remaining = data.maxGenerationQuota != null
        ? Math.max(0, data.maxGenerationQuota - data.usedQuota)
        : null

    return {
        usedQuota: data.usedQuota,
        maxGenerationQuota: data.maxGenerationQuota,
        startDate: data.startDate,
        endDate: data.endDate,
        remaining,
    }
}

export async function requireCredits(minCredits: number = 1): Promise<QuotaInfo> {
    const quota = await checkCredits()

    if (quota.remaining !== null && quota.remaining < minCredits) {
        throw new Error(
            `Insufficient credits. You have ${quota.remaining.toFixed(1)} credits remaining but need at least ${minCredits}. ` +
            `Used: ${quota.usedQuota.toFixed(1)} / ${quota.maxGenerationQuota}. ` +
            `Please upgrade your subscription at https://app.meepo.studio/settings/subscription.`
        )
    }

    return quota
}
