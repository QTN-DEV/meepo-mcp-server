import { homedir } from 'os'
import { join } from 'path'
import { readFileSync, writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs'

const STORE_DIR = join(homedir(), '.meepo')
const STORE_PATH = join(STORE_DIR, 'credentials.json')

interface StoredCredentials {
    accessToken: string
    user: {
        id: string
        email: string
        name: string
        companyId: string
    }
    savedAt: string
}

export function saveToken(accessToken: string, user: any): void {
    if (!existsSync(STORE_DIR)) {
        mkdirSync(STORE_DIR, { recursive: true })
    }
    const data: StoredCredentials = { accessToken, user, savedAt: new Date().toISOString() }
    writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

export function loadToken(): StoredCredentials | null {
    if (!existsSync(STORE_PATH)) return null
    try {
        const data = JSON.parse(readFileSync(STORE_PATH, 'utf-8')) as StoredCredentials
        if (!data.accessToken || !data.user) return null
        return data
    } catch {
        return null
    }
}

export function clearToken(): void {
    if (existsSync(STORE_PATH)) {
        unlinkSync(STORE_PATH)
    }
}
