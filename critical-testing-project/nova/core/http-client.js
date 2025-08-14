/**
 * NOVA HTTP Client - Unified HTTP request handler
 * Executes real HTTP requests with no mocks
 */

const { spawn } = require('child_process');
const https = require('https');
const http = require('http');
const { URL } = require('url');

class HttpClient {
  constructor(config) {
    this.config = config;
    this.defaultTimeout = 30000;
  }

  /**
   * Execute HTTP request using curl for maximum compatibility
   */
  async request(options) {
    const {
      method = 'GET',
      url,
      headers = {},
      body = null,
      timeout = this.defaultTimeout,
      followRedirect = true
    } = options;

    const startTime = Date.now();
    
    // Build curl command
    const curlArgs = ['-i', '-X', method];
    
    // Add headers
    Object.entries(headers).forEach(([key, value]) => {
      curlArgs.push('-H', `${key}: ${value}`);
    });
    
    // Add body if present
    if (body) {
      if (typeof body === 'object') {
        curlArgs.push('--data', JSON.stringify(body));
      } else {
        curlArgs.push('--data', body);
      }
    }
    
    // Add timeout
    curlArgs.push('--max-time', Math.floor(timeout / 1000).toString());
    
    // Follow redirects
    if (followRedirect) {
      curlArgs.push('-L');
    }
    
    // Add URL
    curlArgs.push(url);
    
    // Execute curl
    return new Promise((resolve, reject) => {
      const curl = spawn('curl', curlArgs);
      
      let stdout = '';
      let stderr = '';
      
      curl.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      curl.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      curl.on('close', (code) => {
        const duration = Date.now() - startTime;
        
        if (code !== 0 && code !== null) {
          reject(new Error(`curl failed with code ${code}: ${stderr}`));
          return;
        }
        
        // Parse response
        const response = this.parseCurlResponse(stdout);
        response.duration = duration;
        response.request = {
          method,
          url,
          headers,
          body
        };
        
        resolve(response);
      });
      
      curl.on('error', (error) => {
        reject(new Error(`Failed to execute curl: ${error.message}`));
      });
    });
  }

  /**
   * Parse curl -i output into structured response
   */
  parseCurlResponse(output) {
    const lines = output.split('\n');
    const response = {
      status: null,
      statusText: '',
      headers: {},
      body: '',
      raw: output
    };
    
    let inBody = false;
    let bodyLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!inBody) {
        // First line should be status
        if (i === 0 && line.startsWith('HTTP/')) {
          const parts = line.split(' ');
          response.status = parseInt(parts[1], 10);
          response.statusText = parts.slice(2).join(' ');
        }
        // Header lines
        else if (line.includes(':')) {
          const colonIndex = line.indexOf(':');
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          
          // Handle multiple headers with same name (like Set-Cookie)
          if (response.headers[key]) {
            if (Array.isArray(response.headers[key])) {
              response.headers[key].push(value);
            } else {
              response.headers[key] = [response.headers[key], value];
            }
          } else {
            response.headers[key] = value;
          }
        }
        // Empty line marks end of headers
        else if (line === '') {
          inBody = true;
        }
      } else {
        bodyLines.push(lines[i]); // Don't trim body lines
      }
    }
    
    response.body = bodyLines.join('\n');
    
    // Try to parse JSON body if content-type indicates it
    const contentType = response.headers['content-type'] || response.headers['Content-Type'];
    if (contentType && contentType.includes('application/json')) {
      try {
        response.json = JSON.parse(response.body);
      } catch (e) {
        // Not valid JSON
      }
    }
    
    return response;
  }

  /**
   * Execute multiple requests in parallel
   */
  async batchRequest(requests) {
    return Promise.all(requests.map(req => this.request(req)));
  }

  /**
   * Execute requests sequentially with delay
   */
  async sequentialRequest(requests, delay = 0) {
    const results = [];
    
    for (const req of requests) {
      results.push(await this.request(req));
      
      if (delay > 0) {
        await this.sleep(delay);
      }
    }
    
    return results;
  }

  /**
   * Helper to build URL with query parameters
   */
  buildUrl(baseUrl, params = {}) {
    const url = new URL(baseUrl);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, value);
      }
    });
    
    return url.toString();
  }

  /**
   * Helper for common Agent Mode requests
   */
  async agentRequest(endpoint, options = {}) {
    const baseUrl = this.config.env.url;
    const url = `${baseUrl}/api/${endpoint}`;
    
    const defaultHeaders = {
      'Content-Type': 'application/json'
    };
    
    // Add SDK key if needed
    if (options.sdkKeySource === 'header') {
      defaultHeaders['X-Optimizely-SDK-Key'] = this.config.credentials.sdkKey;
    }
    
    return this.request({
      method: options.method || 'POST',
      url: options.sdkKeySource === 'query' ? 
        this.buildUrl(url, { sdkKey: this.config.credentials.sdkKey }) : url,
      headers: { ...defaultHeaders, ...options.headers },
      body: options.body
    });
  }

  /**
   * Helper for Edge Mode requests
   */
  async edgeRequest(options = {}) {
    const baseUrl = this.config.env.url;
    const url = this.buildUrl(baseUrl, {
      'force-edge-mode': 'true',
      ...options.params
    });
    
    const defaultHeaders = {
      'X-Optimizely-Enable-FEX': 'true',
      'X-Optimizely-SDK-Key': this.config.credentials.sdkKey
    };
    
    return this.request({
      method: 'GET',
      url,
      headers: { ...defaultHeaders, ...options.headers }
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { HttpClient };