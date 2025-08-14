'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [edgeModeStatus, setEdgeModeStatus] = useState('Unknown');
  const [agentModeStatus, setAgentModeStatus] = useState('Unknown');

  useEffect(() => {
    // Check Edge Mode status by looking at response headers
    fetch('/test-edge-mode', { 
      headers: { 
        'X-Optimizely-SDK-Key': process.env.NEXT_PUBLIC_OPTIMIZELY_SDK_KEY || '' 
      }
    })
      .then(res => {
        const optimizelyHeader = res.headers.get('X-Optimizely-Edge-Mode');
        setEdgeModeStatus(optimizelyHeader ? 'Active' : 'Not Active');
      })
      .catch(() => setEdgeModeStatus('Error'));

    // Check Agent Mode status
    fetch('/api/decide', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Optimizely-SDK-Key': process.env.NEXT_PUBLIC_OPTIMIZELY_SDK_KEY || ''
      },
      body: JSON.stringify({
        userId: 'test-user',
        flagKey: 'test-flag'
      })
    })
      .then(res => res.ok ? 'Active' : 'Not Active')
      .then(setAgentModeStatus)
      .catch(() => setAgentModeStatus('Error'));
  }, []);

  return (
    <div>
      <div className="header">
        <h1>Optimizely Edge Agent v2 - Vercel Test Application</h1>
      </div>

      <div className="container">
        <div className="info">
          <strong>Edge Agent Status:</strong> Edge Mode: {edgeModeStatus} | Agent Mode: {agentModeStatus}
        </div>

        <div className="grid">
          <div className="card">
            <h2>🔄 Edge Mode Testing</h2>
            <p>Test automatic content variation based on URL patterns</p>
            
            <h3>Test Pages:</h3>
            <a href="/test-pages/home">
              <button className="button">Home Page Test</button>
            </a>
            <a href="/test-pages/product">
              <button className="button">Product Page Test</button>
            </a>
            <a href="/test-pages/checkout">
              <button className="button">Checkout Page Test</button>
            </a>
            
            <h3>Origin Endpoints (for CDN testing):</h3>
            <div className="code">
              GET /origin/home<br/>
              GET /origin/home-variant<br/>
              GET /origin/product<br/>
              GET /origin/product-variant
            </div>
          </div>

          <div className="card">
            <h2>🚀 Agent Mode Testing</h2>
            <p>Test REST API endpoints for feature decisions</p>
            
            <h3>Interactive API Tester:</h3>
            <a href="/test-api">
              <button className="button">Open API Tester</button>
            </a>
            
            <h3>Quick Tests:</h3>
            <a href="/test-api?test=decide">
              <button className="button secondary">Test /api/decide</button>
            </a>
            <a href="/test-api?test=decide-all">
              <button className="button secondary">Test /api/decide-all</button>
            </a>
            <a href="/test-api?test=datafile">
              <button className="button secondary">Test /api/datafile</button>
            </a>
          </div>

          <div className="card">
            <h2>📊 Metrics Dashboard</h2>
            <p>Monitor Edge Agent performance metrics</p>
            
            <a href="/metrics">
              <button className="button">View Metrics</button>
            </a>
            
            <h3>Environment:</h3>
            <div className="code">
              Platform: Vercel Edge Functions<br/>
              Region: {process.env.VERCEL_REGION || 'unknown'}<br/>
              Metrics Provider: {process.env.METRICS_PROVIDER || 'none'}
            </div>
          </div>

          <div className="card">
            <h2>🛠️ Configuration</h2>
            <p>Current Edge Agent configuration</p>
            
            <h3>Environment Variables:</h3>
            <div className="code">
              SDK Key: {process.env.NEXT_PUBLIC_OPTIMIZELY_SDK_KEY ? '✓ Set' : '✗ Not Set'}<br/>
              Edge Mode: {process.env.OPTIMIZELY_ENABLE_EDGE_MODE || 'true'}<br/>
              Agent Mode: {process.env.OPTIMIZELY_ENABLE_AGENT_MODE || 'true'}<br/>
              Cache TTL: {process.env.OPTIMIZELY_CACHE_TTL || '300'}s
            </div>
            
            <a href="/config">
              <button className="button secondary">View Full Config</button>
            </a>
          </div>
        </div>

        <div className="card">
          <h2>📚 Documentation</h2>
          <p>Learn how to use this test application</p>
          
          <h3>Local Development:</h3>
          <div className="code">
            # Install dependencies<br/>
            npm install<br/><br/>
            
            # Set environment variables<br/>
            cp .env.example .env.local<br/>
            # Edit .env.local with your SDK key<br/><br/>
            
            # Run locally<br/>
            npm run dev
          </div>
          
          <h3>Testing as Origin for Other CDNs:</h3>
          <div className="code">
            # Deploy to Vercel<br/>
            vercel --prod<br/><br/>
            
            # Use these URLs in Cloudflare/Fastly:<br/>
            https://your-app.vercel.app/origin/home<br/>
            https://your-app.vercel.app/origin/home-variant
          </div>
        </div>
      </div>
    </div>
  );
}