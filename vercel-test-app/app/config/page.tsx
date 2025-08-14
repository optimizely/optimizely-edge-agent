'use client';

import { useState, useEffect } from 'react';

export default function ConfigPage() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/config', {
        headers: {
          'X-Optimizely-SDK-Key': process.env.NEXT_PUBLIC_OPTIMIZELY_SDK_KEY || ''
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.status}`);
      }

      const data = await response.json();
      setConfig(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>Edge Agent Configuration</h1>
      </div>

      {loading && (
        <div className="card">
          <p>Loading configuration...</p>
        </div>
      )}

      {error && (
        <div className="card">
          <div className="error">Error: {error}</div>
        </div>
      )}

      {config && (
        <>
          <div className="grid">
            <div className="card">
              <h2>🔧 Runtime Configuration</h2>
              <div className="code">
                <strong>Edge Mode:</strong> {config.edgeMode ? 'Enabled' : 'Disabled'}<br/>
                <strong>Agent Mode:</strong> {config.agentMode ? 'Enabled' : 'Disabled'}<br/>
                <strong>Cache TTL:</strong> {config.cacheTTL || 300} seconds<br/>
                <strong>Log Level:</strong> {config.logLevel || 'info'}<br/>
                <strong>Auto Updates:</strong> {config.autoDatafileUpdates ? 'Enabled' : 'Disabled'}
              </div>
            </div>

            <div className="card">
              <h2>📊 Metrics Configuration</h2>
              <div className="code">
                <strong>Metrics Enabled:</strong> {config.metricsEnabled ? 'Yes' : 'No'}<br/>
                <strong>Provider:</strong> {config.metricsProvider || 'None'}<br/>
                <strong>Sampling Rate:</strong> {config.metricsSamplingRate || 1.0}<br/>
                <strong>Prefix:</strong> {config.metricsPrefix || 'optimizely_edge_'}
              </div>
            </div>

            <div className="card">
              <h2>🌐 Environment</h2>
              <div className="code">
                <strong>Platform:</strong> Vercel Edge Functions<br/>
                <strong>Region:</strong> {process.env.VERCEL_REGION || 'unknown'}<br/>
                <strong>Node Version:</strong> {process.version}<br/>
                <strong>Environment:</strong> {process.env.NODE_ENV}
              </div>
            </div>

            <div className="card">
              <h2>🔐 Security</h2>
              <div className="code">
                <strong>SDK Key:</strong> {config.sdkKey ? '***' + config.sdkKey.slice(-4) : 'Not Set'}<br/>
                <strong>Admin Token:</strong> {config.adminToken ? 'Set' : 'Not Set'}<br/>
                <strong>Debug Headers:</strong> {config.debugHeaders ? 'Enabled' : 'Disabled'}<br/>
                <strong>CORS:</strong> Enabled for /api/* and /origin/*
              </div>
            </div>
          </div>

          <div className="card">
            <h2>📋 Full Configuration</h2>
            <button 
              className="button" 
              onClick={() => {
                const el = document.getElementById('config-json');
                if (el) {
                  el.style.display = el.style.display === 'none' ? 'block' : 'none';
                }
              }}
            >
              Toggle JSON View
            </button>
            
            <div id="config-json" className="code" style={{ display: 'none', marginTop: '1rem' }}>
              {JSON.stringify(config, null, 2)}
            </div>
          </div>

          <div className="card">
            <h2>🔄 Configuration Sources</h2>
            <p>Configuration is loaded in this precedence order:</p>
            <ol style={{ marginLeft: '1.5rem', lineHeight: '1.8' }}>
              <li><strong>HTTP Headers</strong> - X-Optimizely-* headers</li>
              <li><strong>Query Parameters</strong> - ?sdkKey=xxx</li>
              <li><strong>Request Body</strong> - JSON payload</li>
              <li><strong>Environment Variables</strong> - OPTIMIZELY_*</li>
              <li><strong>Default Values</strong> - Built-in defaults</li>
            </ol>
          </div>

          <div className="card">
            <h2>🧪 Test Configuration</h2>
            <p>Try different configuration sources:</p>
            
            <button 
              className="button secondary" 
              onClick={() => {
                window.open('/api/config?sdkKey=test-key-from-query', '_blank');
              }}
            >
              Test Query Parameter
            </button>
            
            <button 
              className="button secondary" 
              onClick={async () => {
                const response = await fetch('/api/config', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Optimizely-SDK-Key': 'test-key-from-header'
                  },
                  body: JSON.stringify({ logLevel: 'debug' })
                });
                const data = await response.json();
                alert('Config with custom header:\n' + JSON.stringify(data, null, 2));
              }}
            >
              Test Headers
            </button>
          </div>
        </>
      )}
    </div>
  );
}