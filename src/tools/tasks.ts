import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { designApi } from '../client.js'
import { login } from '../auth.js'

export function registerTaskTools(server: McpServer) {

    server.registerTool(
        'meepo_task_list',
        {
            title: 'List Tasks',
            description: 'List active AI tasks for a chat. Shows what the AI is currently doing (generating images, analyzing, etc). Tasks have status: pending, running, success, failed.',
            inputSchema: {
                chatId: z.string().describe('Chat ID to list active tasks for'),
            },
            outputSchema: {
                chatId: z.string().describe('Chat ID'),
                title: z.string().describe('Chat title'),
                type: z.string().describe('Chat type'),
                data: z.string().describe('Chat detail data as JSON'),
            },
            annotations: {
                title: 'List Tasks',
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async ({ chatId }) => {
            const { user } = await login()
            const result = await designApi.get(`/api/v1/chats/${chatId}`)
            const chat = result.data?.chat || result.data
            return {
                content: [],
                structuredContent: {
                    chatId,
                    title: chat?.title || '',
                    type: chat?.type || '',
                    data: JSON.stringify({ detail: chat?.detail }, null, 2),
                },
            }
        }
    )
}
