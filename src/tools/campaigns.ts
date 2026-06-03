import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { designApi } from '../client.js'

export function registerCampaignTools(server: McpServer) {

    server.registerTool(
        'meepo_campaign_list',
        {
            title: 'List Campaigns',
            description: 'List all campaigns for a brand. Returns campaign names, objectives, and status.',
            inputSchema: {
                brandId: z.string().describe('Brand ID to list campaigns for'),
            },
            outputSchema: {
                campaigns: z.array(z.object({
                    id: z.string().describe('Campaign ID'),
                    name: z.string().describe('Campaign name'),
                    objective: z.string().nullable().describe('Campaign objective'),
                })).describe('Array of campaigns'),
            },
            annotations: {
                title: 'List Campaigns',
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async ({ brandId }) => {
            const result = await designApi.get(`/api/v1/campaigns?brandId=${brandId}`)
            const campaigns = (result.data?.data?.campaigns || result.data?.campaigns || []).map((c: any) => ({
                id: c.id, name: c.name, objective: c.objective || null,
            }))
            return { content: [], structuredContent: { campaigns } }
        }
    )

    server.registerTool(
        'meepo_campaign_get',
        {
            title: 'Get Campaign Details',
            description: 'Get full campaign details including deliverables, plan, and requirements.',
            inputSchema: {
                campaignId: z.string().describe('Campaign ID to retrieve'),
            },
            outputSchema: {
                id: z.string().describe('Campaign ID'),
                name: z.string().describe('Campaign name'),
                objective: z.string().nullable().describe('Campaign objective'),
                data: z.string().describe('Full campaign data as JSON'),
            },
            annotations: {
                title: 'Get Campaign Details',
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async ({ campaignId }) => {
            const result = await designApi.get(`/api/v1/campaigns/${campaignId}`)
            const c = result.data?.data?.campaign || result.data?.campaign || result.data
            return {
                content: [],
                structuredContent: {
                    id: c.id || campaignId,
                    name: c.name || '',
                    objective: c.objective || null,
                    data: JSON.stringify(c, null, 2),
                },
            }
        }
    )

    server.registerTool(
        'meepo_campaign_create',
        {
            title: 'Create Campaign',
            description: 'Create a new campaign for a brand.',
            inputSchema: {
                brandId: z.string().describe('Brand ID to create campaign for'),
                name: z.string().describe('Campaign name'),
                objective: z.string().describe('Campaign objective or goal'),
            },
            outputSchema: {
                success: z.boolean().describe('Whether creation succeeded'),
                campaignId: z.string().describe('ID of the created campaign'),
            },
            annotations: {
                title: 'Create Campaign',
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
        },
        async ({ brandId, name, objective }) => {
            const result = await designApi.post('/api/v1/campaigns', { brandId, name, objective })
            const c = result.data?.data?.campaign || result.data?.campaign || result.data
            return { content: [], structuredContent: { success: true, campaignId: c.id || '' } }
        }
    )

    server.registerTool(
        'meepo_campaign_update',
        {
            title: 'Update Campaign',
            description: 'Update a campaign name, objective, or details.',
            inputSchema: {
                campaignId: z.string().describe('Campaign ID to update'),
                name: z.string().optional().describe('New campaign name'),
                objective: z.string().optional().describe('New campaign objective'),
            },
            outputSchema: {
                success: z.boolean().describe('Whether update succeeded'),
                campaignId: z.string().describe('Updated campaign ID'),
            },
            annotations: {
                title: 'Update Campaign',
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async ({ campaignId, ...updates }) => {
            const body = Object.fromEntries(Object.entries(updates).filter(([_, v]) => v !== undefined))
            await designApi.put(`/api/v1/campaigns/${campaignId}`, body)
            return { content: [], structuredContent: { success: true, campaignId } }
        }
    )

    server.registerTool(
        'meepo_campaign_delete',
        {
            title: 'Delete Campaign',
            description: 'Permanently delete a campaign. This cannot be undone.',
            inputSchema: {
                campaignId: z.string().describe('Campaign ID to delete'),
            },
            outputSchema: {
                success: z.boolean().describe('Whether deletion succeeded'),
                campaignId: z.string().describe('Deleted campaign ID'),
            },
            annotations: {
                title: 'Delete Campaign',
                readOnlyHint: false,
                destructiveHint: true,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async ({ campaignId }) => {
            await designApi.delete(`/api/v1/campaigns/${campaignId}`)
            return { content: [], structuredContent: { success: true, campaignId } }
        }
    )
}
