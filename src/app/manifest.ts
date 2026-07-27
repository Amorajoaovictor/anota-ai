import type { MetadataRoute } from 'next'

/**
 * Fase 2 entrega só a identidade instalável. Service worker, cache offline e
 * notificações ficam para a Fase 8 do PRD.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Central de Projetos',
    short_name: 'Projetos',
    description: 'Organizador pessoal inteligente de projetos.',
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#0b1011',
    theme_color: '#67bd90',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  }
}
