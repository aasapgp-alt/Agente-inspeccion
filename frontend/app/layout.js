import './globals.css'

export const metadata = {
  title: 'Smart Dashboard',
  description: 'Dashboard Inteligente para Gestión de Activos y Mantenimiento',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es" data-theme="dark">
      <body>{children}</body>
    </html>
  )
}
