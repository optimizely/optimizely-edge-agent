'use client';

import { useState, useEffect } from 'react';

export default function MetricsDashboard() {
  const [metrics, setMetrics] = useState<any>({
    requests: 0,
    avgResponseTime: 0,
    cacheHitRate: 0,
    errors: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching metrics - in production this would query your metrics provider
    const fetchMetrics = async () => {
      try {
        // Mock metrics data
        setMetrics({
          requests: Math.floor(Math.random() * 10000) + 1000,
          avgResponseTime: Math.floor(Math.random() * 50) + 10,
          cacheHitRate: Math.floor(Math.random() * 30) + 70,
          errors: Math.floor(Math.random() * 10),
          decisionTime: Math.floor(Math.random() * 5) + 1,
          datafileSize: 124567,
          flagsEvaluated: Math.floor(Math.random() * 100) + 50,
          uniqueUsers: Math.floor(Math.random() * 1000) + 100
        });
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
        setIsLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container">
      <div className="header">
        <h1>Edge Agent Metrics Dashboard</h1>
      </div>

      {isLoading ? (
        <div className="card">
          <p>Loading metrics...</p>
        </div>
      ) : (
        <>
          <div className="grid">
            <div className="card">
              <h2>🚀 Performance</h2>
              <div className="metrics">
                <div className="metric">
                  <div className="value">{metrics.avgResponseTime}ms</div>
                  <div className="label">Avg Response Time</div>
                </div>
                <div className="metric">
                  <div className="value">{metrics.decisionTime}ms</div>
                  <div className="label">Avg Decision Time</div>
                </div>
                <div className="metric">
                  <div className="value">{metrics.cacheHitRate}%</div>
                  <div className="label">Cache Hit Rate</div>
                </div>
              </div>
            </div>

            <div className="card">
              <h2>📊 Usage</h2>
              <div className="metrics">
                <div className="metric">
                  <div className="value">{metrics.requests.toLocaleString()}</div>
                  <div className="label">Total Requests</div>
                </div>
                <div className="metric">
                  <div className="value">{metrics.uniqueUsers}</div>
                  <div className="label">Unique Users</div>
                </div>
                <div className="metric">
                  <div className="value">{metrics.flagsEvaluated}</div>
                  <div className="label">Flags Evaluated</div>
                </div>
              </div>
            </div>

            <div className="card">
              <h2>🔧 System Health</h2>
              <div className="metrics">
                <div className="metric">
                  <div className="value" style={{ color: metrics.errors > 5 ? '#d32f2f' : '#2e7d32' }}>
                    {metrics.errors}
                  </div>
                  <div className="label">Errors (5m)</div>
                </div>
                <div className="metric">
                  <div className="value">{(metrics.datafileSize / 1024).toFixed(1)}KB</div>
                  <div className="label">Datafile Size</div>
                </div>
                <div className="metric">
                  <div className="value" style={{ color: '#2e7d32' }}>✓</div>
                  <div className="label">Status</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>📈 Real-time Activity</h2>
            <div className="info">
              <strong>Note:</strong> In production, these metrics would come from your configured provider (DataDog, New Relic, or Prometheus).
            </div>
            
            <h3>Recent Decisions:</h3>
            <div className="code">
              {new Date().toISOString()} - User: user_abc123 - Flag: homepage_test - Variation: treatment<br/>
              {new Date(Date.now() - 1000).toISOString()} - User: user_def456 - Flag: checkout_flow - Variation: control<br/>
              {new Date(Date.now() - 2000).toISOString()} - User: user_ghi789 - Flag: pricing_test - Variation: treatment<br/>
            </div>

            <h3>Configuration:</h3>
            <div className="code">
              Metrics Provider: {process.env.METRICS_PROVIDER || 'none'}<br/>
              Platform: Vercel Edge Functions<br/>
              Region: {process.env.VERCEL_REGION || 'unknown'}<br/>
              Environment: {process.env.DD_ENV || process.env.NEW_RELIC_ENVIRONMENT || 'production'}
            </div>
          </div>

          <div className="card">
            <h2>🔍 Monitoring Links</h2>
            <p>Access your metrics in your monitoring platform:</p>
            
            {process.env.METRICS_PROVIDER === 'datadog' && (
              <a href="https://app.datadoghq.com/" target="_blank" rel="noopener noreferrer">
                <button className="button">Open DataDog Dashboard</button>
              </a>
            )}
            
            {process.env.METRICS_PROVIDER === 'newrelic' && (
              <a href="https://one.newrelic.com/" target="_blank" rel="noopener noreferrer">
                <button className="button">Open New Relic Dashboard</button>
              </a>
            )}
            
            {process.env.METRICS_PROVIDER === 'prometheus' && (
              <a href={process.env.PROMETHEUS_PUSH_GATEWAY_URL?.replace(':9091', ':9090')} target="_blank" rel="noopener noreferrer">
                <button className="button">Open Prometheus Dashboard</button>
              </a>
            )}
          </div>
        </>
      )}
    </div>
  );
}