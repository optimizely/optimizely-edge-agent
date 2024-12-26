import { headers } from 'next/headers'

export default function Home() {
  const headersList = headers()
  const variant = headersList.get('x-optimizely-variant') || 'default'
  
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8">
          Optimizely Edge Agent Demo
        </h1>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold mb-4">
            Current Variant: {variant}
          </h2>
          
          <p className="mb-4">
            This page demonstrates the Optimizely Edge Agent integration with Next.js and Vercel.
            The variant is determined by the Edge Middleware and passed through headers.
          </p>
          
          <div className="bg-gray-100 p-4 rounded">
            <pre className="whitespace-pre-wrap">
              {JSON.stringify({ variant }, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </main>
  )
}
