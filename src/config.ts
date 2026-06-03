export const config = {
    authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:8001',
    designServiceUrl: process.env.DESIGN_SERVICE_URL || 'http://localhost:8002',
    subscriptionServiceUrl: process.env.SUBSCRIPTION_SERVICE_URL || 'http://localhost:8003',
    videoServiceUrl: process.env.VIDEO_SERVICE_URL || 'http://localhost:8006',
    email: process.env.MEEPO_EMAIL || '',
    password: process.env.MEEPO_PASSWORD || '',
}
