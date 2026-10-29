import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Central de Projetos',
  description: 'Organizador pessoal inteligente de projetos.',
  applicationName: 'Central de Projetos',
  // Sem `apple`: o iOS não aceita SVG em apple-touch-icon e um PNG dedicado fica para a Fase 8.
  icons: { icon: '/icon.svg' },
  appleWebApp: { capable: true, title: 'Projetos', statusBarStyle: 'black-translucent' },
}

export const viewport: Viewport = {
  themeColor: '#67bd90',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>
}
