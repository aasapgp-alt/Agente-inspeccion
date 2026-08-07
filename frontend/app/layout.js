import './globals.css';

export const metadata = {
  title: 'Inspector PGP - Modo Campo',
  description: 'App móvil de inspección técnica industrial offline-first',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Inspector PGP'
  }
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0284c7'
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="bg-slate-950 text-slate-100 min-h-screen font-sans antialiased selection:bg-sky-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
