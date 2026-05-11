import './globals.css'

export const metadata = {
  title: 'La Parada Bar - Sistema de Gestión',
  description: 'Sistema integral para restaurante',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
