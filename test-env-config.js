// Check if environment configuration is loaded
const baseUrl = 'http://localhost:8787';

async function checkEnvConfig() {
    console.log('🔍 Checking Environment Configuration\n');
    
    try {
        // Try to get SDK info which might show environment details
        const res = await fetch(`${baseUrl}/api/sdk?sdkKey=8mR1pGh8u2ztUP8GqjmQq`, {
            headers: {
                'X-Optimizely-Enable-FEX': 'true'
            }
        });
        
        const data = await res.json();
        console.log('SDK Info:', JSON.stringify(data, null, 2));
        
        // The environment should show in the response
        if (data.environment) {
            console.log('\nEnvironment:', data.environment);
        }
        
        if (data.cdnProvider) {
            console.log('CDN Provider:', data.cdnProvider);
        }
        
    } catch (error) {
        console.error('Failed to get SDK info:', error.message);
    }
}

checkEnvConfig();