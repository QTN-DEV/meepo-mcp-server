import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { designApi } from '../client.js'
import { login } from '../auth.js'

export function registerBrandTools(server: McpServer) {

    server.registerTool(
        'meepo_brand_list',
        {
            title: 'List Brands',
            description: 'List all brands for your company. Returns brand names, logos, color palettes, and IDs. Use this first to discover available brands before creating designs.',
            outputSchema: {
                brands: z.array(z.object({
                    id: z.string().describe('Brand ID'),
                    name: z.string().describe('Brand name'),
                    logo: z.string().nullable().describe('Logo URL'),
                })).describe('Array of brands'),
            },
            annotations: {
                title: 'List Brands',
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async () => {
            const { user } = await login()
            const result = await designApi.get(`/api/v1/brands?companyId=${user.companyId}`)
            const brands = (result.data?.data?.brands || result.data?.brands || []).map((b: any) => ({
                id: b.id, name: b.name, logo: b.logo || null,
            }))
            return { content: [], structuredContent: { brands } }
        }
    )

    server.registerTool(
        'meepo_brand_get',
        {
            title: 'Get Brand Details',
            description: 'Get detailed brand information including color palette, fonts, brand identity, tone of voice, references, and product images.',
            inputSchema: {
                brandId: z.string().describe('The brand ID to retrieve'),
            },
            outputSchema: {
                id: z.string().describe('Brand ID'),
                name: z.string().describe('Brand name'),
                description: z.string().nullable().describe('Brand description'),
                colorPalette: z.array(z.string()).describe('Hex color codes'),
                headingFont: z.string().nullable().describe('Heading font name'),
                bodyFont: z.string().nullable().describe('Body font name'),
                brandIdentity: z.array(z.string()).describe('Brand identity keywords'),
                toneOfVoiceSummary: z.array(z.string()).describe('Tone of voice summary points'),
            },
            annotations: {
                title: 'Get Brand Details',
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async ({ brandId }) => {
            const result = await designApi.get(`/api/v1/brands/${brandId}`)
            const b = result.data?.data?.brand || result.data?.brand || result.data
            return {
                content: [],
                structuredContent: {
                    id: b.id || brandId,
                    name: b.name || '',
                    description: b.description || null,
                    colorPalette: b.colorPalette || [],
                    headingFont: b.headingFont || null,
                    bodyFont: b.bodyFont || null,
                    brandIdentity: b.brandIdentity || [],
                    toneOfVoiceSummary: b.toneOfVoiceSummary || [],
                },
            }
        }
    )

    server.registerTool(
        'meepo_brand_update',
        {
            title: 'Update Brand',
            description: 'Update brand settings such as name, description, color palette, fonts, or brand identity.',
            inputSchema: {
                brandId: z.string().describe('The brand ID to update'),
                name: z.string().optional().describe('New brand name'),
                description: z.string().optional().describe('New brand description'),
                colorPalette: z.array(z.string()).optional().describe('Array of hex color codes'),
                headingFont: z.string().optional().describe('Heading font name'),
                bodyFont: z.string().optional().describe('Body font name'),
                brandIdentity: z.array(z.string()).optional().describe('Brand identity keywords'),
                toneOfVoiceSummary: z.array(z.string()).optional().describe('Tone of voice summary points'),
            },
            outputSchema: {
                success: z.boolean().describe('Whether update succeeded'),
                brandId: z.string().describe('Updated brand ID'),
            },
            annotations: {
                title: 'Update Brand',
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async ({ brandId, ...updates }) => {
            const body = Object.fromEntries(Object.entries(updates).filter(([_, v]) => v !== undefined))
            await designApi.put(`/api/v1/brands/${brandId}`, body)
            return { content: [], structuredContent: { success: true, brandId } }
        }
    )
}
