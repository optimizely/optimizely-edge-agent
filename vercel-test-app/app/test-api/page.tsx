'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const API_ENDPOINTS = {
  decide: { path: '/api/optimizely/decide', method: 'POST' },
  decideAll: { path: '/api/optimizely/decide-all', method: 'POST' },
  decideForKeys: { path: '/api/optimizely/decide-for-keys', method: 'POST' },
  datafile: { path: '/api/optimizely/datafile', method: 'GET' },
  flagKeys: { path: '/api/optimizely/flagkeys', method: 'GET' },
  config: { path: '/api/optimizely/config', method: 'GET' },
  forcedVariation: { path: '/api/optimizely/set-forced-variation', method: 'POST' },
  getForcedVariation: { path: '/api/optimizely/get-forced-variation', method: 'POST' },
  debug: { path: '/api/optimizely/debug', method: 'POST' }
};

const SAMPLE_PAYLOADS: Record<string, any> = {
  decide: {
    userId: 'test-user-123',
    flagKey: 'test_feature',
    attributes: {
      plan: 'premium',
      country: 'US'
    }
  },
  decideAll: {
    userId: 'test-user-123',
    attributes: {
      plan: 'premium'
    },
    decideOptions: ['ENABLED_FLAGS_ONLY']
  },
  decideForKeys: {
    userId: 'test-user-123',
    flagKeys: ['feature_a', 'feature_b', 'feature_c'],
    attributes: {}
  },
  forcedVariation: {
    userId: 'test-user-123',
    flagKey: 'test_feature',
    variationKey: 'treatment'
  },
  getForcedVariation: {
    userId: 'test-user-123',
    flagKey: 'test_feature'
  },
  debug: {
    userId: 'test-user-123'
  }
};

function APITesterContent() {
  const searchParams = useSearchParams();
  const [selectedEndpoint, setSelectedEndpoint] = useState('decide');
  const [method, setMethod] = useState('POST');
  const [headers, setHeaders] = useState(`{
  "Content-Type": "application/json",
  "X-Optimizely-SDK-Key": "${process.env.NEXT_PUBLIC_OPTIMIZELY_SDK_KEY || 'your-sdk-key'}"
}`);
  const [body, setBody] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<any>({});

  useEffect(() => {
    const testParam = searchParams.get('test');
    if (testParam && API_ENDPOINTS[testParam as keyof typeof API_ENDPOINTS]) {
      setSelectedEndpoint(testParam);
    }
  }, [searchParams]);

  useEffect(() => {
    const endpoint = API_ENDPOINTS[selectedEndpoint as keyof typeof API_ENDPOINTS];
    if (endpoint) {
      setMethod(endpoint.method);
      if (endpoint.method === 'POST' && SAMPLE_PAYLOADS[selectedEndpoint]) {
        setBody(JSON.stringify(SAMPLE_PAYLOADS[selectedEndpoint], null, 2));
      } else {
        setBody('');
      }
    }
  }, [selectedEndpoint]);

  const sendRequest = async () => {
    setLoading(true);
    setResponse('');
    const startTime = performance.now();

    try {
      const endpoint = API_ENDPOINTS[selectedEndpoint as keyof typeof API_ENDPOINTS];
      const parsedHeaders = JSON.parse(headers);
      
      const options: RequestInit = {
        method: method,
        headers: parsedHeaders
      };

      if (method !== 'GET' && body) {
        options.body = body;
      }

      const res = await fetch(endpoint.path, options);
      const endTime = performance.now();
      
      // Collect metrics
      const responseHeaders: any = {};
      res.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      setMetrics({
        status: res.status,
        statusText: res.statusText,
        duration: Math.round(endTime - startTime),
        size: responseHeaders['content-length'] || 'unknown',
        headers: responseHeaders
      });

      const contentType = res.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        data = await res.text();
      }

      setResponse(JSON.stringify(data, null, 2));
    } catch (error: any) {
      setResponse(`Error: ${error.message}`);
      setMetrics({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const testGetRequest = async () => {
    // Convert POST body to GET query parameters
    try {
      const bodyObj = JSON.parse(body);
      const queryParams = new URLSearchParams(bodyObj).toString();
      const endpoint = API_ENDPOINTS[selectedEndpoint as keyof typeof API_ENDPOINTS];
      
      setMethod('GET');
      const res = await fetch(`${endpoint.path}?${queryParams}`, {
        headers: JSON.parse(headers)
      });
      
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (error: any) {
      setResponse(`Error: ${error.message}`);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>Optimizely Edge Agent - API Tester</h1>
      </div>

      <div className="grid">
        <div className="card">
          <h2>API Configuration</h2>
          
          <h3>Endpoint:</h3>
          <select 
            className="input" 
            value={selectedEndpoint} 
            onChange={(e) => setSelectedEndpoint(e.target.value)}
          >
            <optgroup label="Decision Endpoints">
              <option value="decide">/api/decide</option>
              <option value="decideAll">/api/decide-all</option>
              <option value="decideForKeys">/api/decide-for-keys</option>
            </optgroup>
            <optgroup label="Data Management">
              <option value="datafile">/api/datafile</option>
              <option value="flagKeys">/api/flagkeys</option>
              <option value="config">/api/config</option>
            </optgroup>
            <optgroup label="Admin">
              <option value="forcedVariation">/api/set-forced-variation</option>
              <option value="getForcedVariation">/api/get-forced-variation</option>
              <option value="debug">/api/debug</option>
            </optgroup>
          </select>

          <h3>Method:</h3>
          <select 
            className="input" 
            value={method} 
            onChange={(e) => setMethod(e.target.value)}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
          </select>

          <h3>Headers:</h3>
          <textarea 
            className="textarea" 
            value={headers} 
            onChange={(e) => setHeaders(e.target.value)}
            rows={5}
          />

          {method !== 'GET' && (
            <>
              <h3>Body:</h3>
              <textarea 
                className="textarea" 
                value={body} 
                onChange={(e) => setBody(e.target.value)}
                rows={10}
              />
            </>
          )}

          <div style={{ marginTop: '1rem' }}>
            <button 
              className="button" 
              onClick={sendRequest} 
              disabled={loading}
            >
              {loading ? 'Sending...' : `Send ${method} Request`}
            </button>
            
            {method === 'POST' && body && (
              <button 
                className="button secondary" 
                onClick={testGetRequest}
              >
                Test as GET
              </button>
            )}
          </div>
        </div>

        <div className="card">
          <h2>Response</h2>
          
          {metrics.status && (
            <div className="metrics">
              <div className="metric">
                <div className="value">{metrics.status}</div>
                <div className="label">Status Code</div>
              </div>
              <div className="metric">
                <div className="value">{metrics.duration}ms</div>
                <div className="label">Duration</div>
              </div>
              <div className="metric">
                <div className="value">{metrics.size}</div>
                <div className="label">Size (bytes)</div>
              </div>
            </div>
          )}

          {response && (
            <>
              <h3>Response Body:</h3>
              <div className="response">
                {response}
              </div>
              
              {metrics.headers && (
                <>
                  <h3>Response Headers:</h3>
                  <div className="code">
                    {Object.entries(metrics.headers).map(([key, value]) => (
                      <div key={key}>{key}: {String(value)}</div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Quick Test Scenarios</h2>
        
        <h3>Test Feature Decision:</h3>
        <button 
          className="button secondary" 
          onClick={() => {
            setSelectedEndpoint('decide');
            setBody(JSON.stringify({
              userId: 'user_' + Math.random().toString(36).substr(2, 9),
              flagKey: 'test_feature',
              attributes: { experiment_group: 'A' }
            }, null, 2));
          }}
        >
          Random User Decision
        </button>
        
        <button 
          className="button secondary" 
          onClick={() => {
            setSelectedEndpoint('decide');
            setBody(JSON.stringify({
              userId: 'premium_user',
              flagKey: 'premium_feature',
              attributes: { plan: 'premium', revenue: 1000 }
            }, null, 2));
          }}
        >
          Premium User Decision
        </button>

        <h3>Test Forced Variations:</h3>
        <button 
          className="button secondary" 
          onClick={() => {
            setSelectedEndpoint('forcedVariation');
            setBody(JSON.stringify({
              userId: 'qa_tester',
              flagKey: 'test_feature',
              variationKey: 'treatment'
            }, null, 2));
          }}
        >
          Force Treatment Variation
        </button>
      </div>
    </div>
  );
}

export default function APITester() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <APITesterContent />
    </Suspense>
  );
}