import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { designApi } from '../client.js'

export function registerFileTools(server: McpServer) {

    server.registerTool(
        'meepo_file_register_url',
        {
            title: 'Register File URL',
            description: 'Register an external file URL as an attachment. Returns the URL that can be used in messages. Use this for linking existing hosted images.',
            inputSchema: {
                url: z.string().url().describe('Public URL of the file to register'),
                mimetype: z.string().optional().describe('MIME type of the file (e.g. image/png, image/jpeg). Defaults to image/png'),
            },
            outputSchema: {
                url: z.string().describe('Registered file URL'),
                mimetype: z.string().describe('MIME type of the file'),
                message: z.string().describe('Status message'),
            },
            annotations: {
                title: 'Register File URL',
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async ({ url, mimetype }) => {
            return {
                content: [],
                structuredContent: {
                    url,
                    mimetype: mimetype || 'image/png',
                    message: 'URL registered as attachment',
                },
            }
        }
    )
}
