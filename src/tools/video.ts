import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { videoApi } from '../client.js'
import { requireCredits } from '../auth.js'

export function registerVideoTools(server: McpServer) {

    server.registerTool(
        'meepo_video_list_projects',
        {
            title: 'List Video Projects',
            description: 'List all video projects. Returns project titles, descriptions, and IDs.',
            outputSchema: {
                projects: z.array(z.object({
                    id: z.string().describe('Project ID'),
                    title: z.string().describe('Project title'),
                })).describe('Array of video projects'),
            },
            annotations: {
                title: 'List Video Projects',
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async () => {
            const result = await videoApi.get('/api/v1/projects')
            const projects = (result.data?.data?.projects || result.data?.projects || []).map((p: any) => ({
                id: p.id || '', title: p.title || '',
            }))
            return { content: [], structuredContent: { projects } }
        }
    )

    server.registerTool(
        'meepo_video_create_project',
        {
            title: 'Create Video Project',
            description: 'Create a new video project.',
            inputSchema: {
                title: z.string().describe('Video project title'),
                description: z.string().optional().describe('Project description'),
            },
            outputSchema: {
                success: z.boolean().describe('Whether creation succeeded'),
                projectId: z.string().describe('ID of the created project'),
            },
            annotations: {
                title: 'Create Video Project',
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
        },
        async ({ title, description }) => {
            const result = await videoApi.post('/api/v1/projects', { title, description })
            const p = result.data?.data?.project || result.data?.project || result.data
            return {
                content: [],
                structuredContent: {
                    success: true,
                    projectId: p.id || '',
                },
            }
        }
    )

    server.registerTool(
        'meepo_video_generate',
        {
            title: 'Generate Video',
            description: 'Trigger video generation for a project. This uses 5 credits.',
            inputSchema: {
                projectId: z.string().describe('Video project ID to generate video for'),
                prompt: z.string().describe('Video generation prompt describing the desired video'),
            },
            outputSchema: {
                success: z.boolean().describe('Whether generation was triggered'),
                data: z.string().describe('Generation result as JSON'),
            },
            annotations: {
                title: 'Generate Video',
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: true,
            },
        },
        async ({ projectId, prompt }) => {
            await requireCredits(5)
            const result = await videoApi.post('/api/v1/generate', { projectId, prompt })
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
