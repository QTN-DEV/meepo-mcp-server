import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { designApi } from '../client.js'
import { requireCredits } from '../auth.js'

export function registerMessageTools(server: McpServer) {

    server.registerTool(
        'meepo_message_list',
        {
            title: 'List Messages',
            description: 'List all messages in a design request chat. Returns message content, direction (INCOMING/OUTGOING), attachments, and timestamps.',
            inputSchema: {
                chatId: z.string().describe('Chat ID to list messages for'),
                limit: z.number().optional().describe('Maximum number of messages to return (default 50)'),
            },
            outputSchema: {
                messages: z.array(z.object({
                    id: z.string().describe('Message ID'),
                    content: z.string().describe('Message text content'),
                    direction: z.string().describe('INCOMING or OUTGOING'),
                })).describe('Array of messages'),
            },
            annotations: {
                title: 'List Messages',
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async ({ chatId, limit }) => {
            const params = new URLSearchParams({ chatId })
            if (limit) params.set('limit', String(limit))
            const result = await designApi.get(`/api/v1/messages?${params}`)
            const messages = (result.data?.data?.messages || result.data?.messages || []).map((m: any) => ({
                id: m.id || '', content: m.content || '', direction: m.direction || 'INCOMING',
            }))
            return { content: [], structuredContent: { messages } }
        }
    )

    server.registerTool(
        'meepo_message_send',
        {
            title: 'Send Message',
            description: 'Send a follow-up message in a design request chat. Use this for edit requests, feedback, or new instructions. This triggers the AI to process your message and may use credits.',
            inputSchema: {
                chatId: z.string().describe('Chat ID to send message in'),
                content: z.string().describe('Message content — your instruction or feedback'),
                replyToId: z.string().optional().describe('Message ID to reply to (for editing a specific image)'),
            },
            outputSchema: {
                success: z.boolean().describe('Whether send succeeded'),
                messageId: z.string().describe('ID of the sent message'),
            },
            annotations: {
                title: 'Send Message',
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: true,
            },
        },
        async ({ chatId, content, replyToId }) => {
            await requireCredits(1)
            const body: Record<string, unknown> = { chatId, content, direction: 'OUTGOING' }
            if (replyToId) body.replyToId = replyToId
            const result = await designApi.post('/api/v1/messages', body)
            const m = result.data?.data?.message || result.data?.message || result.data
            return {
                content: [],
                structuredContent: {
                    success: true,
                    messageId: m.id || '',
                },
            }
        }
    )

    server.registerTool(
        'meepo_message_generate_caption',
        {
            title: 'Generate Caption',
            description: 'Generate a social media caption for a specific design image. Uses 0.5 credits.',
            inputSchema: {
                messageId: z.string().describe('Message ID containing the image to generate caption for'),
            },
            outputSchema: {
                success: z.boolean().describe('Whether caption generation succeeded'),
                caption: z.string().describe('Generated social media caption'),
            },
            annotations: {
                title: 'Generate Caption',
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: true,
            },
        },
        async ({ messageId }) => {
            await requireCredits(0.5)
            const result = await designApi.post(`/api/v1/messages/${messageId}/caption`)
            const data = result.data?.data || result.data
            return {
                content: [],
                structuredContent: {
                    success: true,
                    caption: data?.caption || JSON.stringify(data, null, 2),
                },
            }
        }
    )

    server.registerTool(
        'meepo_message_generate_variant',
        {
            title: 'Generate Design Variant',
            description: 'Generate a design variant of a specific image. Creates an alternative version of the design. Uses 1 credit.',
            inputSchema: {
                messageId: z.string().describe('Message ID containing the image to create variant of'),
            },
            outputSchema: {
                success: z.boolean().describe('Whether variant generation succeeded'),
                data: z.string().describe('Variant generation result as JSON'),
            },
            annotations: {
                title: 'Generate Design Variant',
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: true,
            },
        },
        async ({ messageId }) => {
            await requireCredits(1)
            const result = await designApi.post(`/api/v1/messages/${messageId}/variant`)
            return {
                content: [],
                structuredContent: {
                    success: true,
                    data: JSON.stringify(result.data, null, 2),
                },
            }
        }
    )
}
