import { NextResponse } from 'next/server';

export async function GET() {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Home - Control Version</title>
  <meta name="variation" content="control">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .hero {
      background: #0052CC;
      color: white;
      padding: 3rem;
      text-align: center;
      border-radius: 8px;
      margin-bottom: 2rem;
    }
    .features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
      margin-top: 2rem;
    }
    .feature {
      padding: 1.5rem;
      background: #f8f9fa;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="hero">
      <h1>Welcome to Our Service</h1>
      <p>The trusted solution for your business needs</p>
      <button style="padding: 0.75rem 2rem; font-size: 1rem; background: white; color: #0052CC; border: none; border-radius: 4px; cursor: pointer;">
        Get Started
      </button>
    </div>
    
    <h2>Why Choose Us?</h2>
    <div class="features">
      <div class="feature">
        <h3>Reliable</h3>
        <p>99.9% uptime guaranteed with enterprise-grade infrastructure.</p>
      </div>
      <div class="feature">
        <h3>Secure</h3>
        <p>Bank-level security to protect your data.</p>
      </div>
      <div class="feature">
        <h3>Fast</h3>
        <p>Lightning-fast performance across the globe.</p>
      </div>
    </div>
    
    <div style="margin-top: 2rem; padding: 1rem; background: #e3f2fd; border-radius: 4px;">
      <strong>Version:</strong> Control (A) | 
      <strong>Cache Key:</strong> home_control | 
      <strong>Generated:</strong> ${new Date().toISOString()}
    </div>
  </div>
</body>
</html>
  `;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'public, max-age=300',
      'X-Origin-Version': 'control',
      'X-Optimizely-Origin': 'true'
    }
  });
}