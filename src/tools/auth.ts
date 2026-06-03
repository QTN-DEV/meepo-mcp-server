import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { login, logout } from '../auth.js'

export function registerAuthTools(server: McpServer) {
    server.registerTool(
        'meepo_login',
        {
            title: 'Login',
            description: 'Login to your Meepo account using email and password. Only needed to switch accounts — authentication is automatic via browser login on first use.',
            inputSchema: {
                email: z.string().email().describe('Account email address'),
                password: z.string().describe('Account password'),
            },
            outputSchema: {
                success: z.boolean().describe('Whether login succeeded'),
                email: z.string().describe('Logged-in user email'),
                companyId: z.string().describe('Company ID for the account'),
                message: z.string().describe('Human-readable status message'),
            },
            annotations: {
                title: 'Login',
                destructiveHint: true,
                readOnlyHint: false,
                idempotentHint: true,
                openWorldHint: true,
            },
        },
        async ({ email, password }) => {
            try {
                const { user } = await login(email, password)
                return {
                    content: [],
                    structuredContent: {
                        success: true,
                        email: user.email,
                        companyId: user.companyId,
                        message: `Successfully logged in as ${user.email}`,
                    },
                }
            } catch (error: any) {
                return {
                    content: [],
                    structuredContent: {
                        success: false,
                        email: '',
                        companyId: '',
                        message: `Login failed: ${error.message}`,
                    },
                    isError: true,
                }
            }
        }
    )

    server.registerTool(
        'meepo_logout',
        {
            title: 'Logout',
            description: 'Logout from the current Meepo account and clear saved credentials from disk.',
            outputSchema: {
                success: z.boolean().describe('Whether logout succeeded'),
                message: z.string().describe('Human-readable status message'),
            },
            annotations: {
                title: 'Logout',
                destructiveHint: true,
                readOnlyHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async () => {
            logout()
            return {
                content: [],
                structuredContent: {
                    success: true,
                    message: 'Successfully logged out. Saved credentials cleared.',
                },
            }
        }
    )
}
