'use client'

import { ArrowRight, Kanban, MagicWand } from '@phosphor-icons/react'
import { Heading } from './heading'
import { Button, type Notify } from './ui'

export function IntegrationsView({ notify }: { notify: Notify }) {
  return <>
    <Heading level="section" title="Integrações" icon={<Kanban size={34} />} subtitle="Conexões externas sincronizadas com a base local." />
    <div className="integration-grid">
      <section className="view-panel integration-card"><Kanban size={30} /><strong>Trello</strong><span>Conecte quadros, listas e cards na próxima fase.</span><Button variant="primary" onClick={() => notify('Conexão com Trello será configurada na Fase 5')}>Configurar</Button></section>
      <section className="view-panel integration-card"><MagicWand size={30} /><strong>IA</strong><span>Revisão de plano ativa com recomendações locais.</span><Button trailing={<ArrowRight size={16} />} onClick={() => notify('Revisão da IA aberta')}>Abrir revisão</Button></section>
    </div>
  </>
}
