import './globals.css';
import { EmpresaConfigProvider } from './context/EmpresaConfigContext';

export const metadata = {
  title: 'La Parada Bar - Sistema de Gestión',
  description: 'Sistema integral para restaurante',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <EmpresaConfigProvider>
        <body>{children}</body>
      </EmpresaConfigProvider>
    </html>
  );
}
