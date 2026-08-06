import './globals.css'

export const metadata = {
  title: 'Agente Inspector PGP',
  description: 'Plataforma de inspección técnica industrial con IA y soporte offline para planta',
  manifest: '/manifest.json',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0f172a',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es" data-theme="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined' && 'serviceWorker' in navigator && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  for(var i = 0; i < registrations.length; i++) {
                    registrations[i].unregister();
                  }
                }).catch(function() {});
              }
            `
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
