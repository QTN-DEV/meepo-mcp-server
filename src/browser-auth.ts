import { createServer } from 'http'
import { exec } from 'child_process'
import { platform } from 'os'

const MCP_AUTH_URL = process.env.MCP_AUTH_URL || 'https://studio.meepo.app/mcp-auth'
const CALLBACK_PORT_START = 9004
const CALLBACK_PORT_END = 9010

/**
 * Tries to bind a TCP server to ports CALLBACK_PORT_START..CALLBACK_PORT_END.
 * Returns the port that succeeded, or rejects if all are in use.
 */
function findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        let port = CALLBACK_PORT_START

        const tryPort = () => {
            if (port > CALLBACK_PORT_END) {
                reject(new Error(`No free port found in range ${CALLBACK_PORT_START}-${CALLBACK_PORT_END}. Please retry.`))
                return
            }
            const probe = createServer()
            probe.listen(port, '127.0.0.1', () => {
                probe.close(() => resolve(port))
            })
            probe.on('error', () => {
                port++
                tryPort()
            })
        }

        tryPort()
    })
}

/**
 * Opens the system browser to the Meepo MCP auth page and waits for the
 * user to sign in. Returns the access token sent back via the local callback.
 */
export async function openBrowserAndWaitForToken(): Promise<{ accessToken: string; user: any }> {
    const callbackPort = await findFreePort()

    return new Promise((resolve, reject) => {
        const server = createServer((req, res) => {
            const url = new URL(req.url || '/', `http://localhost:${callbackPort}`)

            if (url.pathname === '/callback') {
                const token = url.searchParams.get('token')
                if (!token) {
                    res.writeHead(400)
                    res.end('Missing token')
                    return
                }

                // Respond to the browser fetch (no-cors) — just close gracefully
                res.writeHead(200, {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'text/plain',
                })
                res.end('OK')

                // Shut down the callback server
                server.close()

                // Decode the user from the JWT payload (no secret needed for extraction)
                try {
                    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
                    resolve({ accessToken: token, user: { id: payload.userId } })
                } catch {
                    resolve({ accessToken: token, user: {} })
                }
            } else {
                res.writeHead(404)
                res.end()
            }
        })

        server.listen(callbackPort, '127.0.0.1', () => {
            const callbackUrl = `http://localhost:${callbackPort}/callback`
            const authUrl = `${MCP_AUTH_URL}?callback=${encodeURIComponent(callbackUrl)}`

            // Open the browser
            const os = platform()
            const cmd = os === 'win32' ? `start "" "${authUrl}"` :
                os === 'darwin' ? `open "${authUrl}"` :
                    `xdg-open "${authUrl}"`

            exec(cmd, (err) => {
                if (err) {
                    process.stderr.write(`[meepo-mcp] Failed to open browser: ${err.message}\n`)
                }
            })

            process.stderr.write(
                `\n[meepo-mcp] Browser login required.\n` +
                `If the browser didn't open, visit:\n  ${authUrl}\n\n`
            )
        })

        server.on('error', (err) => {
            reject(new Error(`Callback server error: ${err.message}`))
        })

        // Timeout after 5 minutes
        setTimeout(() => {
            server.close()
            reject(new Error('Browser login timed out after 5 minutes.'))
        }, 5 * 60 * 1000)
    })
}
