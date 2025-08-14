import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Optimizely Edge Agent Test',
  description: 'Test application for Edge Agent v2 on Vercel',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}