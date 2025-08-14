import { NextResponse } from 'next/server';

export async function GET() {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Home - Variant Version</title>
  <meta name="variation" content="treatment">
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
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .hero {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 4rem;
      text-align: center;
      border-radius: 8px;
      margin-bottom: 2rem;
    }
    .cta-button {
      padding: 1rem 3rem;
      font-size: 1.2rem;
      background: #ff6b6b;
      color: white;
      border: none;
      border-radius: 50px;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(255, 107, 107, 0.3);
      transition: all 0.3s;
    }
    .cta-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(255, 107, 107, 0.4);
    }
    .benefits {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-top: 3rem;
    }
    .benefit {
      padding: 2rem;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      border-radius: 8px;
      text-align: center;
      transition: transform 0.3s;
    }
    .benefit:hover {
      transform: translateY(-5px);
    }
    .testimonial {
      margin-top: 3rem;
      padding: 2rem;
      background: #f8f9fa;
      border-left: 4px solid #667eea;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="hero">
      <h1>Transform Your Business Today!</h1>
      <p style="font-size: 1.2rem; margin: 1.5rem 0;">Join thousands of successful companies</p>
      <button class="cta-button">
        Start Free Trial - No Credit Card Required
      </button>
      <p style="margin-top: 1rem; opacity: 0.9;">⭐ Rated 4.9/5 by 1000+ customers</p>
    </div>
    
    <h2 style="text-align: center; font-size: 2rem;">Why Leading Companies Choose Us</h2>
    <div class="benefits">
      <div class="benefit">
        <h3 style="color: #667eea;">🚀 10x Faster</h3>
        <p>Accelerate your workflow with our cutting-edge technology.</p>
      </div>
      <div class="benefit">
        <h3 style="color: #667eea;">💰 Save 50%</h3>
        <p>Reduce costs while increasing productivity and output.</p>
      </div>
      <div class="benefit">
        <h3 style="color: #667eea;">📈 Guaranteed Results</h3>
        <p>See measurable improvements within 30 days or money back.</p>
      </div>
    </div>
    
    <div class="testimonial">
      <blockquote style="margin: 0; font-style: italic; font-size: 1.1rem;">
        "This solution transformed our business. We saw a 300% increase in efficiency within the first month!"
      </blockquote>
      <p style="margin-top: 1rem; font-weight: bold;">- Sarah Johnson, CEO of TechCorp</p>
    </div>
    
    <div style="margin-top: 2rem; padding: 1rem; background: #e8f5e9; border-radius: 4px;">
      <strong>Version:</strong> Treatment (B) | 
      <strong>Cache Key:</strong> home_variant | 
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
      'X-Origin-Version': 'treatment',
      'X-Optimizely-Origin': 'true'
    }
  });
}