import './globals.css'

export const metadata = {
  title: 'Smart Dashboard',
  description: 'Dashboard Inteligente para Gestión de Activos y Mantenimiento',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
