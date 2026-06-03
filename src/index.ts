#!/usr/bin/env node

import crypto from 'crypto'
import express from 'express'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { registerAuthTools } from './tools/auth.js'
import { registerBrandTools } from './tools/brands.js'
import { registerCampaignTools } from './tools/campaigns.js'
import { registerChatTools } from './tools/chats.js'
import { registerMessageTools } from './tools/messages.js'
import { registerGenerationTools } from './tools/generations.js'
import { registerTemplateTools } from './tools/templates.js'
import { registerVideoTools } from './tools/video.js'
import { registerTaskTools } from './tools/tasks.js'
import { registerSubscriptionTools } from './tools/subscription.js'
import { registerFileTools } from './tools/files.js'
import cors from 'cors'
import { config } from './config.js'

// ── Helpers ──────────────────────────────────────────────────
function getPublicUrl(req?: express.Request): string {
    if (process.env.MCP_PUBLIC_URL) return process.env.MCP_PUBLIC_URL
    if (req) {
        const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https'
        return `${proto}://${req.headers.host}`
    }
    return `http://localhost:${process.env.PORT || 8008}`
}

function renderLoginPage(params: { redirect_uri: string; state: string; code_challenge: string; client_id: string; error?: string }): string {
    const { redirect_uri, state, code_challenge, client_id, error } = params
    const errorHtml = error
        ? `<div style="background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.35);border-radius:10px;padding:10px 14px;color:#f87171;font-size:13px;margin-bottom:4px">${escapeHtml(error)}</div>`
        : ''

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Sign in to Meepo</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',system-ui,sans-serif;background:#0a0a0a;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}
.card{width:100%;max-width:400px;background:#171717;border:1px solid #262626;border-radius:16px;padding:32px;box-shadow:0 25px 50px -12px rgba(0,0,0,.5)}
.logo{display:block;height:28px;margin:0 auto 20px}
.title{text-align:center;font-size:18px;font-weight:700;margin-bottom:4px}
.subtitle{text-align:center;font-size:13px;color:#a3a3a3;margin-bottom:24px}
label{display:block;font-size:13px;font-weight:500;color:#d4d4d4;margin-bottom:5px}
input[type=email],input[type=password]{width:100%;padding:9px 12px;background:#262626;border:1px solid #404040;border-radius:8px;color:#fff;font-size:14px;font-family:inherit;outline:none;transition:border-color .15s}
input:focus{border-color:#14b8a6}
.field{margin-bottom:16px}
btn,button[type=submit]{width:100%;padding:10px;background:#0d9488;border:none;border-radius:8px;color:#fff;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;transition:background .15s}
button[type=submit]:hover{background:#14b8a6}
.footer{text-align:center;font-size:11px;color:#525252;margin-top:20px}
</style>
</head>
<body>
<div class="card">
  <img src="https://studio.meepo.app/logo-dark-mode.png" alt="Meepo" class="logo"/>
  <div class="title">Connect to Meepo</div>
  <div class="subtitle">Sign in to give your AI agent access</div>
  ${errorHtml}
  <form method="POST" action="/oauth/authorize">
    <input type="hidden" name="redirect_uri" value="${escapeAttr(redirect_uri)}"/>
    <input type="hidden" name="state" value="${escapeAttr(state)}"/>
    <input type="hidden" name="code_challenge" value="${escapeAttr(code_challenge)}"/>
    <input type="hidden" name="client_id" value="${escapeAttr(client_id)}"/>
    <div class="field">
      <label for="email">Email</label>
      <input type="email" id="email" name="email" required placeholder="you@example.com" autocomplete="email"/>
    </div>
    <div class="field">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required placeholder="••••••••"/>
    </div>
    <button type="submit">Sign In & Connect</button>
  </form>
  <div class="footer">This connection is secure. Your credentials are never stored by MCP clients.</div>
</div>
</body>
</html>`
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
function escapeAttr(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function createMcpServer() {
    const server = new McpServer({
        name: 'meepo-studio',
        version: '1.0.0',
        description: 'Meepo Studio - AI-powered design platform. Create social media designs, carousels, videos, and manage campaigns directly from your AI agent.',
    })

    // Register all tool groups
    registerAuthTools(server)
    registerBrandTools(server)
    registerCampaignTools(server)
    registerChatTools(server)
    registerMessageTools(server)
    registerGenerationTools(server)
    registerTemplateTools(server)
    registerVideoTools(server)
    registerTaskTools(server)
    registerSubscriptionTools(server)
    registerFileTools(server)

    return server
}

if (process.env.TRANSPORT === 'sse' || true) { // Kept user's local override for testing HTTP locally
    // K8s / HTTP Deployment Mode
    const app = express()
    app.use(cors({
        origin: true,
        exposedHeaders: ['WWW-Authenticate'],
    }))
    app.use(express.json())
    const transports = new Map<string, SSEServerTransport>()

    // ── Streamable HTTP session store ─────────────────────────
    const httpSessions = new Map<string, { server: McpServer; transport: StreamableHTTPServerTransport }>()

    app.get('/health', (req, res) => {
        res.json({ status: 'ok', service: 'meepo-mcp-server' })
    })

    // ── Glama ownership verification ──────────────────────────
    app.get('/.well-known/glama.json', (req, res) => {
        res.json({
            "$schema": "https://glama.ai/mcp/schemas/connector.json",
            "maintainers": [{ "email": "lastblezebub@gmail.com" }]
        })
    })

    // ── MCP Server Card (Smithery scanner fallback) ────────────
    app.get('/.well-known/mcp/server-card.json', (req, res) => {
        res.json({
            serverInfo: {
                name: 'meepo-studio',
                version: '1.0.0',
                description: 'Meepo Studio - AI-powered design platform. Create social media designs, carousels, videos, and manage campaigns directly from your AI agent.'
            },
            authentication: {
                required: true,
                schemes: ['oauth2']
            },
            tools: [
                { name: 'meepo_login', description: 'Login to your Meepo account using email and password.' },
                { name: 'meepo_logout', description: 'Logout from the current Meepo account and clear saved credentials.' },
                { name: 'meepo_brand_list', description: 'List all brands for your company.' },
                { name: 'meepo_brand_get', description: 'Get detailed brand information including color palette, fonts, identity, tone of voice.' },
                { name: 'meepo_brand_update', description: 'Update brand settings such as name, description, color palette, fonts.' },
                { name: 'meepo_campaign_list', description: 'List all campaigns for a brand.' },
                { name: 'meepo_campaign_get', description: 'Get full campaign details including deliverables and plan.' },
                { name: 'meepo_campaign_create', description: 'Create a new campaign for a brand.' },
                { name: 'meepo_campaign_update', description: 'Update a campaign name, objective, or details.' },
                { name: 'meepo_campaign_delete', description: 'Permanently delete a campaign.' },
                { name: 'meepo_chat_list', description: 'List all design request chats.' },
                { name: 'meepo_chat_get', description: 'Get a specific design request chat with messages and generated images.' },
                { name: 'meepo_chat_create', description: 'Create a new design request. Starts a conversation with the AI designer. Uses credits.' },
                { name: 'meepo_chat_update', description: 'Update a chat title or move to a folder.' },
                { name: 'meepo_chat_delete', description: 'Permanently delete a design request chat.' },
                { name: 'meepo_file_register_url', description: 'Register an external file URL as an attachment.' },
                { name: 'meepo_generation_list', description: 'List all generated images/designs for a chat.' },
                { name: 'meepo_generation_poll', description: 'Poll for AI-generated images until all slides are ready.' },
                { name: 'meepo_message_list', description: 'List all messages in a design request chat.' },
                { name: 'meepo_message_send', description: 'Send a follow-up message in a design request chat. Uses credits.' },
                { name: 'meepo_message_generate_caption', description: 'Generate a social media caption for a specific image.' },
                { name: 'meepo_message_generate_variant', description: 'Generate a design variant of a specific image.' },
                { name: 'meepo_credits_check', description: 'Check your current credit balance.' },
                { name: 'meepo_subscription_status', description: 'Get current subscription details including plan and features.' },
                { name: 'meepo_task_list', description: 'List active AI tasks for a chat.' },
                { name: 'meepo_template_list', description: 'List available design templates.' },
                { name: 'meepo_template_get', description: 'Get template details including preview and prompt structure.' },
                { name: 'meepo_video_list_projects', description: 'List all video projects.' },
                { name: 'meepo_video_create_project', description: 'Create a new video project.' },
                { name: 'meepo_video_generate', description: 'Trigger video generation for a project. Uses 5 credits.' },
            ],
            resources: [],
            prompts: []
        })
    })

    // OAuth Endpoints
    const authCodes = new Map<string, any>()

    app.get('/.well-known/oauth-protected-resource', (req, res) => {
        const publicUrl = getPublicUrl(req)
        res.json({
            resource: publicUrl,
            authorization_servers: [publicUrl],
            scopes_supported: ["meepo"]
        })
    })

    app.get('/.well-known/oauth-authorization-server', (req, res) => {
        const publicUrl = getPublicUrl(req)
        res.json({
            issuer: publicUrl,
            authorization_endpoint: `${publicUrl}/oauth/authorize`,
            token_endpoint: `${publicUrl}/oauth/token`,
            registration_endpoint: `${publicUrl}/oauth/register`,
            response_types_supported: ["code"],
            grant_types_supported: ["authorization_code"],
            code_challenge_methods_supported: ["S256"],
            token_endpoint_auth_methods_supported: ["none"],
            client_id_metadata_document_supported: true,
            scopes_supported: ["meepo"]
        })
    })

    // ── Dynamic Client Registration (RFC 7591) ───────────────
    app.post('/oauth/register', (req, res) => {
        const { client_name, redirect_uris, grant_types, response_types, token_endpoint_auth_method } = req.body || {}
        const clientId = `meepo-${crypto.randomUUID()}`

        res.status(201).json({
            client_id: clientId,
            client_name: client_name || 'MCP Client',
            redirect_uris: redirect_uris || [],
            grant_types: grant_types || ['authorization_code'],
            response_types: response_types || ['code'],
            token_endpoint_auth_method: token_endpoint_auth_method || 'none',
        })
    })

    // ── GET /oauth/authorize — Redirect to Meepo Studio sign-in ──
    // Users with existing session auto-authenticate without re-entering credentials.
    // Falls back to inline login page via POST /oauth/authorize for direct form submission.
    app.get('/oauth/authorize', (req, res) => {
        const publicUrl = getPublicUrl(req)
        const mcpAuthUrl = process.env.MCP_AUTH_URL || 'https://studio.meepo.app/mcp-auth'

        const params = new URLSearchParams({
            oauth: '1',
            mcp_server_url: publicUrl,
            redirect_uri: (req.query.redirect_uri as string) || '',
            state: (req.query.state as string) || '',
            code_challenge: (req.query.code_challenge as string) || '',
            client_id: (req.query.client_id as string) || '',
        })
        res.redirect(`${mcpAuthUrl}?${params.toString()}`)
    })

    // ── POST /oauth/authorize — Server-side credential verification ──
    app.post('/oauth/authorize', express.urlencoded({ extended: true }), async (req, res) => {
        const { email, password, redirect_uri, state, code_challenge, client_id } = req.body

        try {
            // Verify credentials server-side via auth service
            const authRes = await fetch(`${config.authServiceUrl}/api/v1/auth/user/mcp/sign-in`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            })

            if (!authRes.ok) {
                const errBody = await authRes.json().catch(() => ({})) as any
                let errorMsg = 'Invalid email or password.'
                if (errBody?.detail === 'EMAIL_NOT_VERIFIED') {
                    errorMsg = 'Please verify your email before connecting.'
                }
                res.setHeader('Content-Type', 'text/html')
                res.send(renderLoginPage({ redirect_uri, state, code_challenge, client_id, error: errorMsg }))
                return
            }

            const result = await authRes.json() as any
            const token = result.data?.accessToken

            if (!token) {
                res.setHeader('Content-Type', 'text/html')
                res.send(renderLoginPage({ redirect_uri, state, code_challenge, client_id, error: 'Authentication succeeded but no token returned.' }))
                return
            }

            // Generate auth code and redirect to client
            const code = crypto.randomBytes(32).toString('base64url')
            authCodes.set(code, { token, code_challenge, redirect_uri })

            // Auto-expire auth codes after 10 minutes
            setTimeout(() => authCodes.delete(code), 10 * 60 * 1000)

            const redirectUrl = new URL(redirect_uri)
            redirectUrl.searchParams.set('code', code)
            if (state) redirectUrl.searchParams.set('state', state)
            res.redirect(redirectUrl.toString())
        } catch (err: any) {
            console.error('[oauth/authorize] Error:', err.message)
            res.setHeader('Content-Type', 'text/html')
            res.send(renderLoginPage({ redirect_uri, state, code_challenge, client_id, error: 'Connection to auth service failed. Please try again.' }))
        }
    })

    // ── POST /oauth/authorize/submit — Legacy endpoint for frontend McpAuthPage ──
    app.post('/oauth/authorize/submit', express.json(), (req, res) => {
        const { token, redirect_uri, state, code_challenge } = req.body
        const code = crypto.randomBytes(32).toString('base64url')
        authCodes.set(code, { token, code_challenge, redirect_uri })
        setTimeout(() => authCodes.delete(code), 10 * 60 * 1000)

        try {
            const redirectUrl = new URL(redirect_uri)
            redirectUrl.searchParams.set('code', code)
            redirectUrl.searchParams.set('state', state)
            res.json({ redirect_url: redirectUrl.toString() })
        } catch (e) {
            res.status(400).json({ error: 'invalid_request', error_description: 'Invalid redirect_uri' })
        }
    })

    app.post('/oauth/token', express.json(), express.urlencoded({ extended: true }), (req, res) => {
        const { grant_type, code, code_verifier } = req.body
        if (grant_type !== 'authorization_code') {
            res.status(400).json({ error: 'unsupported_grant_type' })
            return
        }

        const codeData = authCodes.get(code)
        if (!codeData) {
            res.status(400).json({ error: 'invalid_grant', error_description: 'Code not found or expired' })
            return
        }

        const hash = crypto.createHash('sha256').update(code_verifier).digest('base64url')
        if (hash !== codeData.code_challenge) {
            res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE challenge failed' })
            return
        }

        authCodes.delete(code)

        res.json({
            access_token: codeData.token,
            token_type: "Bearer",
            expires_in: 86400 * 365
        })
    })

    // Simple Authentication Middleware
    const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const authHeader = req.headers.authorization
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            const publicUrl = getPublicUrl(req)
            res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${publicUrl}/.well-known/oauth-protected-resource"`)
            res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid Bearer token.' })
            return
        }
        next()
    }

    // ── Streamable HTTP Transport (/mcp) ──────────────────────
    app.all('/mcp', authenticate, async (req, res) => {
        const sessionId = req.headers['mcp-session-id'] as string | undefined

        // DELETE — terminate session
        if (req.method === 'DELETE') {
            if (sessionId && httpSessions.has(sessionId)) {
                const session = httpSessions.get(sessionId)!
                await session.transport.close()
                httpSessions.delete(sessionId)
                res.status(200).end()
            } else {
                res.status(404).send('Session not found')
            }
            return
        }

        // Existing session — route to its transport
        if (sessionId && httpSessions.has(sessionId)) {
            const session = httpSessions.get(sessionId)!
            await session.transport.handleRequest(req, res, req.body)
            return
        }

        // No session or unknown session — only allow initialize
        if (sessionId && !httpSessions.has(sessionId)) {
            res.status(404).send('Session not found')
            return
        }

        // New session — create transport + server
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => crypto.randomUUID(),
        })
        const server = createMcpServer()
        await server.connect(transport)
        await transport.handleRequest(req, res, req.body)

        if (transport.sessionId) {
            httpSessions.set(transport.sessionId, { server, transport })
            transport.onclose = () => {
                httpSessions.delete(transport.sessionId!)
            }
        }
    })

    // ── Legacy SSE Transport (/sse + /messages) ──────────────
    app.get('/sse', authenticate, async (req, res) => {
        // Keep the SSE connection alive
        req.socket.setTimeout(0);
        res.socket?.setTimeout(0);

        const transport = new SSEServerTransport('/messages', res)
        const server = createMcpServer()
        await server.connect(transport)

        if (transport.sessionId) {
            transports.set(transport.sessionId, transport)
            res.on('close', () => {
                transports.delete(transport.sessionId)
                try {
                    transport.close()
                } catch (e) {
                    // Ignore close errors
                }
            })
        }
    })

    app.post('/messages', authenticate, async (req, res) => {
        const sessionId = req.query.sessionId as string
        console.log(`[POST /messages] Request received for sessionId: ${sessionId}`)

        const transport = transports.get(sessionId)
        if (!transport) {
            console.log(`[POST /messages] Session not found for sessionId: ${sessionId}`)
            res.status(404).send('Session not found or SSE transport not initialized.')
            return
        }
        try {
            await transport.handlePostMessage(req, res)
        } catch (error) {
            console.error(`[POST /messages] Error handling post message:`, error)
        }
    })

    const PORT = Number(process.env.PORT ?? 8008)
    app.listen(PORT, '0.0.0.0', () => {
        console.error(`[meepo-mcp] Server listening on http://0.0.0.0:${PORT}`)
        console.error(`[meepo-mcp] MCP Streamable HTTP endpoint: http://0.0.0.0:${PORT}/mcp`)
        console.error(`[meepo-mcp] MCP SSE endpoint (legacy): http://0.0.0.0:${PORT}/sse`)
    })
} else {
    // IDE / Local Development Mode (Antigravity, Claude Desktop, Cursor)
    const server = createMcpServer()
    const transport = new StdioServerTransport()
    await server.connect(transport)
    console.error('[meepo-mcp] Server started using stdio transport')
}
