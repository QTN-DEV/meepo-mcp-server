import { config } from './config.js'
import { login } from './auth.js'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

async function request(
    baseUrl: string,
    path: string,
    method: HttpMethod = 'GET',
    body?: Record<string, unknown>
): Promise<any> {
    const { token } = await login()

    const url = `${baseUrl}${path}`
    const headers: Record<string, string> = {
        'Cookie': `userAccessToken=${token}`,
        'Content-Type': 'application/json',
    }

    const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
        const errorBody = await response.text()
        throw new Error(`API ${method} ${path} failed (${response.status}): ${errorBody}`)
    }

    return response.json()
}

// Design Service (brands, campaigns, chats, messages, generations, templates, files)
export const designApi = {
    get: (path: string) => request(config.designServiceUrl, path, 'GET'),
    post: (path: string, body?: Record<string, unknown>) => request(config.designServiceUrl, path, 'POST', body),
    put: (path: string, body?: Record<string, unknown>) => request(config.designServiceUrl, path, 'PUT', body),
    delete: (path: string) => request(config.designServiceUrl, path, 'DELETE'),
}

// Subscription Service
export const subscriptionApi = {
    get: (path: string) => request(config.subscriptionServiceUrl, path, 'GET'),
    post: (path: string, body?: Record<string, unknown>) => request(config.subscriptionServiceUrl, path, 'POST', body),
}

// Video Service
export const videoApi = {
    get: (path: string) => request(config.videoServiceUrl, path, 'GET'),
    post: (path: string, body?: Record<string, unknown>) => request(config.videoServiceUrl, path, 'POST', body),
    put: (path: string, body?: Record<string, unknown>) => request(config.videoServiceUrl, path, 'PUT', body),
}
