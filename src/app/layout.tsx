import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Central de Projetos',
  description: 'Organizador pessoal inteligente de projetos.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>
}
