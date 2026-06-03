import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { checkCredits } from '../auth.js'
import { subscriptionApi } from '../client.js'
import { login } from '../auth.js'

export function registerSubscriptionTools(server: McpServer) {

    server.registerTool(
        'meepo_credits_check',
        {
            title: 'Check Credits',
            description: 'Check your current credit balance. Shows used credits, total credits, and remaining credits for your subscription period.',
            outputSchema: {
                summary: z.string().describe('Human-readable credit summary'),
                usedQuota: z.number().describe('Number of credits used'),
                maxGenerationQuota: z.number().nullable().describe('Maximum credit quota (null for unlimited)'),
                remaining: z.number().nullable().describe('Credits remaining (null for unlimited)'),
                startDate: z.string().nullable().describe('Billing period start date'),
                endDate: z.string().nullable().describe('Billing period end date'),
            },
            annotations: {
                title: 'Check Credits',
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async () => {
            const quota = await checkCredits()
            const summary = quota.remaining !== null
                ? `Credits: ${quota.usedQuota.toFixed(1)} used / ${quota.maxGenerationQuota} total (${quota.remaining.toFixed(1)} remaining)`
                : `Credits used: ${quota.usedQuota.toFixed(1)} (unlimited plan)`

            return {
                content: [],
                structuredContent: {
                    summary,
                    usedQuota: quota.usedQuota,
                    maxGenerationQuota: quota.maxGenerationQuota,
                    remaining: quota.remaining,
                    startDate: quota.startDate,
                    endDate: quota.endDate,
                },
            }
        }
    )

    server.registerTool(
        'meepo_subscription_status',
        {
            title: 'Subscription Status',
            description: 'Get your current subscription details including plan, billing period, and features.',
            outputSchema: {
                data: z.string().describe('Subscription details as JSON'),
            },
            annotations: {
                title: 'Subscription Status',
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async () => {
            const { user } = await login()
            const result = await subscriptionApi.get(`/api/v1/subscriptions/${user.companyId}`)
            return {
                content: [],
                structuredContent: {
                    data: JSON.stringify(result.data, null, 2),
                },
            }
        }
    )
}
