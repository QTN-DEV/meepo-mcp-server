import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { designApi } from '../client.js'

export function registerGenerationTools(server: McpServer) {

    server.registerTool(
        'meepo_generation_list',
        {
            title: 'List Generated Images',
            description: 'List all generated images/designs for a chat. Returns URLs of generated images and credit usage.',
            inputSchema: {
                chatId: z.string().describe('Chat ID to list generations for'),
            },
            outputSchema: {
                generations: z.array(z.object({
                    id: z.string().describe('Generation ID'),
                    urls: z.array(z.string()).describe('Generated image URLs'),
                    creditUsed: z.number().describe('Credits consumed'),
                })).describe('Array of generated designs'),
            },
            annotations: {
                title: 'List Generated Images',
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async ({ chatId }) => {
            const result = await designApi.get(`/api/v1/generations?chatId=${chatId}`)
            const generations = (result.data?.generations || []).map((g: any) => ({
                id: g.id || '', urls: g.urls || [], creditUsed: g.creditUsed || 0,
            }))
            return { content: [], structuredContent: { generations } }
        }
    )

    server.registerTool(
        'meepo_generation_poll',
        {
            title: 'Poll Generation Status',
            description: 'Poll for AI-generated images until all slides are ready. Waits up to 30 minutes, but returns immediately once images are ready. Use this after meepo_chat_create to retrieve completed designs.',
            inputSchema: {
                chatId: z.string().describe('Chat ID to poll generations for'),
                expectedSlides: z.number().optional().describe('Number of slides to wait for (default 1). Poll exits once total images >= this value'),
            },
            outputSchema: {
                status: z.enum(['completed', 'timeout']).describe('Poll result: completed or timeout'),
                attempts: z.number().describe('Number of poll attempts made'),
                totalImages: z.number().describe('Total number of generated images'),
                generations: z.string().describe('Generation data as JSON'),
            },
            annotations: {
                title: 'Poll Generation Status',
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true,
            },
        },
        async ({ chatId, expectedSlides = 1 }) => {
            const maxAttempts = 600
            console.error(`[generation_poll] Polling chat ${chatId} for ${expectedSlides} slide(s)...`)

            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                try {
                    const result = await designApi.get(`/api/v1/generations?chatId=${chatId}`)
                    const generations: any[] = result.data.generations || []
                    const totalUrls = generations.reduce((acc, g) => acc + (g.urls?.length || 0), 0)

                    if (totalUrls >= expectedSlides) {
                        console.error(`[generation_poll] Done after ${attempt + 1} attempt(s).`)
                        return {
                            content: [],
                            structuredContent: {
                                status: 'completed' as const,
                                attempts: attempt + 1,
                                totalImages: totalUrls,
                                generations: JSON.stringify(generations, null, 2),
                            },
                        }
                    }
                } catch (e: any) {
                    console.error(`[generation_poll] Attempt ${attempt + 1} error:`, e?.message)
                }
                await new Promise(resolve => setTimeout(resolve, 3000))
            }

            const lastResult = await designApi.get(`/api/v1/generations?chatId=${chatId}`).catch(() => ({ data: { generations: [] } }))
            const generations = lastResult.data.generations || []
            const totalUrls = generations.reduce((acc: number, g: any) => acc + (g.urls?.length || 0), 0)

            return {
                content: [],
                structuredContent: {
                    status: 'timeout' as const,
                    attempts: maxAttempts,
                    totalImages: totalUrls,
                    generations: JSON.stringify(generations, null, 2),
                },
            }
        }
    )
}
