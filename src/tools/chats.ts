import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { designApi } from '../client.js'
import { login, requireCredits } from '../auth.js'

export function registerChatTools(server: McpServer) {

    server.registerTool(
        'meepo_chat_list',
        {
            title: 'List Design Requests',
            description: 'List all design request chats. Returns chat titles, types (AI/HUMAN), and status. Use this to see existing design requests.',
            inputSchema: {
                brandId: z.string().optional().describe('Filter by brand ID'),
                limit: z.number().optional().describe('Maximum number of results to return (default 20)'),
            },
            outputSchema: {
                chats: z.array(z.object({
                    id: z.string().describe('Chat ID'),
                    title: z.string().describe('Chat title'),
                    type: z.string().describe('Chat type: AI or HUMAN'),
                })).describe('Array of design request chats'),
            },
            annotations: {
                title: 'List Design Requests',
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async ({ brandId, limit }) => {
            const { user } = await login()
            const params = new URLSearchParams({ companyId: user.companyId })
            if (brandId) params.set('brandId', brandId)
            if (limit) params.set('limit', String(limit))
            const result = await designApi.get(`/api/v1/chats?${params}`)
            const chats = (result.data?.data?.chats || result.data?.chats || []).map((c: any) => ({
                id: c.id, title: c.title || 'Untitled', type: c.type || 'AI',
            }))
            return { content: [], structuredContent: { chats } }
        }
    )

    server.registerTool(
        'meepo_chat_get',
        {
            title: 'Get Design Request',
            description: 'Get a specific design request chat with all its messages and generated images.',
            inputSchema: {
                chatId: z.string().describe('Chat ID to retrieve'),
            },
            outputSchema: {
                id: z.string().describe('Chat ID'),
                title: z.string().describe('Chat title'),
                type: z.string().describe('Chat type'),
                data: z.string().describe('Full chat data as JSON'),
            },
            annotations: {
                title: 'Get Design Request',
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async ({ chatId }) => {
            const result = await designApi.get(`/api/v1/chats/${chatId}`)
            const c = result.data?.data?.chat || result.data?.chat || result.data
            return {
                content: [],
                structuredContent: {
                    id: c.id || chatId,
                    title: c.title || '',
                    type: c.type || 'AI',
                    data: JSON.stringify(result.data, null, 2),
                },
            }
        }
    )

    server.registerTool(
        'meepo_chat_create',
        {
            title: 'Create Design Request',
            description: 'Create a new design request. This starts a conversation with the AI designer. Use type "AI" for AI-generated preview or "HUMAN" for human designer. The initial message should describe what you want designed. This uses credits.',
            inputSchema: {
                brandId: z.string().describe('Brand ID for the design'),
                title: z.string().describe('Request title (e.g. "Instagram post for summer sale")'),
                type: z.enum(['AI', 'HUMAN']).describe('AI for instant AI preview, HUMAN for human designer queue'),
                prompt: z.string().describe('Design brief — describe what you want designed'),
                designFormat: z.string().optional().describe('Design format (e.g. "Social Media Post Design", "Digital Banner Design")'),
                ratio: z.string().optional().describe('Aspect ratio (e.g. 1:1, 9:16, 16:9, 2:3, 4:5)'),
                multipleDesign: z.boolean().optional().describe('Set true for carousel or multi-slide designs'),
                maxSlides: z.number().optional().describe('Maximum number of slides for carousel (3-15)'),
            },
            outputSchema: {
                success: z.boolean().describe('Whether creation succeeded'),
                chatId: z.string().describe('ID of the created chat'),
                data: z.string().describe('Full response data as JSON'),
            },
            annotations: {
                title: 'Create Design Request',
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: true,
            },
        },
        async ({ brandId, title, type, prompt, designFormat, ratio, multipleDesign, maxSlides }) => {
            await requireCredits(1)

            const lines: string[] = []
            const basicInfo: string[] = []
            basicInfo.push(`- Prompt: ${prompt}`)
            if (designFormat) basicInfo.push(`- Design Format: ${designFormat}`)
            if (ratio) basicInfo.push(`- Ratio: ${ratio}`)
            if (multipleDesign !== undefined) basicInfo.push(`- Multiple Design: ${multipleDesign ? 'Yes' : 'No'}`)
            if (multipleDesign && maxSlides) basicInfo.push(`- Max Slides: ${maxSlides}`)

            if (basicInfo.length > 0) {
                lines.push('Basic Information:')
                lines.push(...basicInfo)
            }

            const content = lines.join('\n')

            const result = await designApi.post('/api/v1/chats', {
                brandId, title, type,
                initialMessage: { content, attachments: [], direction: 'OUTGOING' },
            })

            const chatId = result.data.chat.id
            let finalData = result.data

            if (type === 'AI') {
                console.error(`[mcp] Polling for generation completion on chat ${chatId}...`)
                const maxAttempts = 600
                for (let attempts = 0; attempts < maxAttempts; attempts++) {
                    try {
                        const genResult = await designApi.get(`/api/v1/generations?chatId=${chatId}`)
                        const generations = genResult.data.generations || []
                        const totalUrls = generations.reduce((acc: number, g: any) => acc + (g.urls?.length || 0), 0)
                        const expectedSlides = maxSlides || 1

                        if (totalUrls >= expectedSlides) {
                            console.error(`[mcp] Generation completed after ${attempts} attempts with ${totalUrls} images.`)
                            finalData = { ...result.data, generations }
                            break
                        }
                    } catch (e) {
                        console.error(`[mcp] Polling error:`, e)
                    }
                    await new Promise(resolve => setTimeout(resolve, 3000))
                }
            }

            return {
                content: [],
                structuredContent: {
                    success: true,
                    chatId,
                    data: JSON.stringify(finalData, null, 2),
                },
            }
        }
    )

    server.registerTool(
        'meepo_chat_update',
        {
            title: 'Update Design Request',
            description: 'Update a chat title or move it to a folder.',
            inputSchema: {
                chatId: z.string().describe('Chat ID to update'),
                title: z.string().optional().describe('New chat title'),
                folderId: z.string().optional().describe('Folder ID to move chat to'),
            },
            outputSchema: {
                success: z.boolean().describe('Whether update succeeded'),
                chatId: z.string().describe('Updated chat ID'),
            },
            annotations: {
                title: 'Update Design Request',
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async ({ chatId, ...updates }) => {
            const body = Object.fromEntries(Object.entries(updates).filter(([_, v]) => v !== undefined))
            await designApi.put(`/api/v1/chats/${chatId}`, body)
            return { content: [], structuredContent: { success: true, chatId } }
        }
    )

    server.registerTool(
        'meepo_chat_delete',
        {
            title: 'Delete Design Request',
            description: 'Permanently delete a design request chat. This cannot be undone.',
            inputSchema: {
                chatId: z.string().describe('Chat ID to delete'),
            },
            outputSchema: {
                success: z.boolean().describe('Whether deletion succeeded'),
                chatId: z.string().describe('Deleted chat ID'),
            },
            annotations: {
                title: 'Delete Design Request',
                readOnlyHint: false,
                destructiveHint: true,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async ({ chatId }) => {
            await designApi.delete(`/api/v1/chats/${chatId}`)
            return { content: [], structuredContent: { success: true, chatId } }
        }
    )
}
