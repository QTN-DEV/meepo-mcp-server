import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { designApi } from '../client.js'

export function registerTemplateTools(server: McpServer) {

    server.registerTool(
        'meepo_template_list',
        {
            title: 'List Templates',
            description: 'List available design templates. Templates are pre-made layouts you can use for quick design generation.',
            outputSchema: {
                templates: z.array(z.object({
                    id: z.string().describe('Template ID'),
                    name: z.string().describe('Template name'),
                })).describe('Array of available templates'),
            },
            annotations: {
                title: 'List Templates',
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async () => {
            const result = await designApi.get('/api/v1/templates')
            const templates = (result.data?.data?.templates || result.data?.templates || []).map((t: any) => ({
                id: t.id || '', name: t.name || '',
            }))
            return { content: [], structuredContent: { templates } }
        }
    )

    server.registerTool(
        'meepo_template_get',
        {
            title: 'Get Template Details',
            description: 'Get template details including preview image and prompt structure.',
            inputSchema: {
                templateId: z.string().describe('Template ID to retrieve'),
            },
            outputSchema: {
                id: z.string().describe('Template ID'),
                name: z.string().describe('Template name'),
                data: z.string().describe('Full template data as JSON'),
            },
            annotations: {
                title: 'Get Template Details',
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async ({ templateId }) => {
            const result = await designApi.get(`/api/v1/templates/${templateId}`)
            const t = result.data?.data?.template || result.data?.template || result.data
            return {
                content: [],
                structuredContent: {
                    id: t.id || templateId,
                    name: t.name || '',
                    data: JSON.stringify(t, null, 2),
                },
            }
        }
    )
}
