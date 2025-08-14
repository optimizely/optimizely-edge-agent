'use client';

import { useEffect, useState } from 'react';

export default function HomePage() {
  const [variation, setVariation] = useState('unknown');
  const [headers, setHeaders] = useState<any>({});

  useEffect(() => {
    // Check response headers to see which variation was served
    fetch(window.location.href, { method: 'HEAD' })
      .then(res => {
        const relevantHeaders: any = {};
        res.headers.forEach((value, key) => {
          if (key.toLowerCase().includes('optimizely') || 
              key.toLowerCase().includes('variation') ||
              key.toLowerCase().includes('cache')) {
            relevantHeaders[key] = value;
          }
        });
        setHeaders(relevantHeaders);
        
        // Determine variation from headers or content
        const variationHeader = res.headers.get('X-Optimizely-Variation');
        if (variationHeader) {
          setVariation(variationHeader);
        }
      });
  }, []);

  return (
    <div className="container">
      <div className="header">
        <h1>Edge Mode Test - Home Page</h1>
      </div>

      <div className={`card ${variation === 'B' ? 'variation-b' : 'variation-a'}`}>
        <h2>Content Variation Test</h2>
        <p>This page demonstrates Edge Mode content variation.</p>
        
        <div className="info">
          <strong>Current Variation:</strong> {variation || 'Control (A)'}
        </div>

        <h3>How it works:</h3>
        <ol style={{ marginLeft: '1.5rem', lineHeight: '1.8' }}>
          <li>Edge Agent intercepts this request</li>
          <li>Evaluates feature flags based on user context</li>
          <li>Serves appropriate content variant</li>
          <li>Caches the decision for performance</li>
        </ol>

        <h3>Response Headers:</h3>
        <div className="code">
          {Object.entries(headers).length > 0 ? (
            Object.entries(headers).map(([key, value]) => (
              <div key={key}>{key}: {String(value)}</div>
            ))
          ) : (
            'Loading headers...'
          )}
        </div>

        <h3>Test with different users:</h3>
        <button 
          className="button" 
          onClick={() => {
            document.cookie = 'optimizely_user_id=user_123; path=/';
            window.location.reload();
          }}
        >
          Test as User 123
        </button>
        <button 
          className="button" 
          onClick={() => {
            document.cookie = 'optimizely_user_id=user_456; path=/';
            window.location.reload();
          }}
        >
          Test as User 456
        </button>
        <button 
          className="button secondary" 
          onClick={() => {
            document.cookie = 'optimizely_user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
            window.location.reload();
          }}
        >
          Clear User ID
        </button>
      </div>

      <div className="card">
        <h2>Feature Flag Configuration</h2>
        <p>This test expects a feature flag with cdnVariationSettings:</p>
        <div className="code">
{`{
  "flagKey": "home_page_test",
  "variations": {
    "control": {
      "cdnVariationSettings": {
        "cdnExperimentURL": "/test-pages/home",
        "cdnResponseURL": "/origin/home",
        "cacheKey": "home_control",
        "cacheTTL": 300
      }
    },
    "treatment": {
      "cdnVariationSettings": {
        "cdnExperimentURL": "/test-pages/home",
        "cdnResponseURL": "/origin/home-variant",
        "cacheKey": "home_variant",
        "cacheTTL": 300
      }
    }
  }
}`}
        </div>
      </div>
    </div>
  );
}