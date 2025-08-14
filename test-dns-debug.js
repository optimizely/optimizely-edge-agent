// Debug DNS resolution for edgeagent.demo.optimizely.com
const dns = require('dns').promises;
const https = require('https');

async function debugDNS() {
    console.log('🔍 Debugging edgeagent.demo.optimizely.com\n');
    
    try {
        // 1. DNS Lookup
        const addresses = await dns.resolve4('edgeagent.demo.optimizely.com');
        console.log('DNS A Records:', addresses);
        
        // 2. Reverse DNS
        for (const addr of addresses) {
            try {
                const hostnames = await dns.reverse(addr);
                console.log(`Reverse DNS for ${addr}:`, hostnames);
            } catch (e) {
                console.log(`Reverse DNS for ${addr}: No PTR record`);
            }
        }
        
        // 3. Try to fetch with Node.js
        console.log('\n📡 Attempting to fetch /login-2.html with Node.js...');
        
        const options = {
            hostname: 'edgeagent.demo.optimizely.com',
            port: 443,
            path: '/login-2.html',
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        };
        
        const req = https.request(options, (res) => {
            console.log(`Status: ${res.statusCode}`);
            console.log(`Headers:`, res.headers);
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log(`\nResponse preview (first 500 chars):`);
                console.log(data.substring(0, 500));
            });
        });
        
        req.on('error', (e) => {
            console.error(`Request error: ${e.message}`);
        });
        
        req.end();
        
    } catch (error) {
        console.error('DNS lookup failed:', error.message);
    }
}

debugDNS();