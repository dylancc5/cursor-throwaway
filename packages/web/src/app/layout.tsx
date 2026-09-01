import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cursor Usage Burner — High-Throughput Cloud Agent Observability',
  description:
    'Real-time telemetry and burn orchestrator for consuming Cursor Pro included usage via parallel cloud agents with live observability and safety caps.',
  keywords: ['Cursor', 'Cursor Pro', 'Cloud Agents', 'Observability', 'Burn Rate', 'Telemetry'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-slate-100 antialiased min-h-screen selection:bg-cyan-500/30 selection:text-cyan-200">
        {children}
      </body>
    </html>
  );
}
